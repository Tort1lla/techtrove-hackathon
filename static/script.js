// Get user data from localStorage or use defaults
let userData = JSON.parse(localStorage.getItem('valdoUserData')) || null;
let isFirstTimeUser = localStorage.getItem('valdoFirstTimeUser') === 'true';
let mealsLogged = JSON.parse(localStorage.getItem('valdoMeals')) || [];
let currentStream = null;
let currentCamera = 'environment';
let stepCount = 0;
let pedometer = null;
let stepUpdateInterval = null;

// Save user data to localStorage
function saveUserData() {
  localStorage.setItem('valdoUserData', JSON.stringify(userData));
}

function saveMeals() {
  localStorage.setItem('valdoMeals', JSON.stringify(mealsLogged));
}

function saveFirstTimeUser() {
  localStorage.setItem('valdoFirstTimeUser', isFirstTimeUser.toString());
}

// Clear all user data (for logout)
function clearUserData() {
  localStorage.removeItem('valdoUserData');
  localStorage.removeItem('valdoMeals');
  localStorage.removeItem('valdoFirstTimeUser');
  localStorage.removeItem('valdoStepCount');
  localStorage.removeItem('valdoStepCountDate');
  userData = null;
  mealsLogged = [];
  isFirstTimeUser = false;
  if (pedometer) {
    pedometer.stop();
  }
  if (stepUpdateInterval) {
    clearInterval(stepUpdateInterval);
  }
}

// Get today's meals only
function getTodaysMeals() {
  const today = new Date().toISOString().split('T')[0];
  return mealsLogged.filter(meal => meal.date === today);
}

// Calculate total sugar from meals
function getTotalSugar(meals) {
  return meals.reduce((total, meal) => total + (meal.sugar || 0), 0);
}

// Initialize step counter
function initializeStepCounter() {
  // Load saved step count
  const savedSteps = localStorage.getItem('valdoStepCount');
  const savedDate = localStorage.getItem('valdoStepCountDate');
  const today = new Date().toDateString();

  if (savedDate === today && savedSteps) {
    stepCount = parseInt(savedSteps);
  } else {
    stepCount = 0;
    localStorage.setItem('valdoStepCountDate', today);
    saveStepCount();
  }

  // Try to use device sensors if available
  if ('Accelerometer' in window || 'LinearAccelerationSensor' in window) {
    try {
      initializeSensorStepCounter();
    } catch (error) {
      console.log('Sensor step counter failed, using mock:', error);
      initializeMockStepCounter();
    }
  } else {
    initializeMockStepCounter();
  }

  updateStepDisplay();
}

function initializeSensorStepCounter() {
  let lastAcceleration = 0;
  let stepThreshold = 12; // Adjust based on testing
  let stepCooldown = false;

  window.addEventListener('devicemotion', (event) => {
    if (stepCooldown) return;

    const acceleration = event.accelerationIncludingGravity;
    if (acceleration) {
      const currentAcceleration = Math.sqrt(
        acceleration.x * acceleration.x +
        acceleration.y * acceleration.y +
        acceleration.z * acceleration.z
      );

      // Simple step detection algorithm
      const delta = Math.abs(currentAcceleration - lastAcceleration);
      if (delta > stepThreshold && currentAcceleration > 9.5 && currentAcceleration < 11.5) {
        stepCount++;
        updateStepDisplay();
        saveStepCount();

        // Cooldown to prevent multiple counts for one step
        stepCooldown = true;
        setTimeout(() => {
          stepCooldown = false;
        }, 300);
      }
      lastAcceleration = currentAcceleration;
    }
  });
}

function initializeMockStepCounter() {
  // Generate realistic step pattern throughout the day
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();

  // Base steps based on time of day
  let baseSteps = 0;
  if (hours < 6) {
    baseSteps = Math.floor(Math.random() * 500); // Night: 0-500 steps
  } else if (hours < 12) {
    baseSteps = 2000 + Math.floor(Math.random() * 3000); // Morning: 2000-5000 steps
  } else if (hours < 18) {
    baseSteps = 5000 + Math.floor(Math.random() * 4000); // Afternoon: 5000-9000 steps
  } else {
    baseSteps = 7000 + Math.floor(Math.random() * 3000); // Evening: 7000-10000 steps
  }

  // Add steps based on minutes passed today
  const minutesPassed = hours * 60 + minutes;
  const stepsPerMinute = baseSteps / (24 * 60);
  const timeBasedSteps = Math.floor(stepsPerMinute * minutesPassed);

  stepCount = Math.max(stepCount, timeBasedSteps);

  // Simulate step increases every few minutes
  stepUpdateInterval = setInterval(() => {
    const increment = Math.floor(Math.random() * 3) + 1; // 1-3 steps
    stepCount += increment;
    updateStepDisplay();
    saveStepCount();
  }, 30000); // Update every 30 seconds
}

function saveStepCount() {
  localStorage.setItem('valdoStepCount', stepCount.toString());
}

function updateStepDisplay() {
  const stepElement = document.getElementById('stepCount');
  if (stepElement) {
    stepElement.textContent = stepCount.toLocaleString();
    stepElement.classList.add('step-update');
    setTimeout(() => {
      stepElement.classList.remove('step-update');
    }, 500);
  }
}

// Get AI feedback for today's data
async function getTodaysFeedback() {
  const todaysMeals = getTodaysMeals();
  const totalSugar = getTotalSugar(todaysMeals);
  const totalCalories = todaysMeals.reduce((sum, meal) => sum + meal.calories, 0);
  const totalCarbs = todaysMeals.reduce((sum, meal) => sum + (meal.carbs || 0), 0);
  const totalProtein = todaysMeals.reduce((sum, meal) => sum + (meal.protein || 0), 0);

  const prompt = `Provide brief, encouraging health feedback (max 2 sentences) based on today's data:
- Steps: ${stepCount}
- Meals logged: ${todaysMeals.length}
- Total calories: ${totalCalories}
- Total sugar: ${totalSugar}g
- Total carbs: ${totalCarbs}g
- Total protein: ${totalProtein}g

Focus on positive reinforcement and gentle suggestions. Keep it very concise and motivating.`;

  try {
    const response = await fetch('http://localhost:5000/chat', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: prompt })
    });

    const data = await response.json();
    return data.reply || "Great job tracking your health today! Every step and meal logged brings you closer to your goals.";
  } catch (error) {
    console.error('Error getting AI feedback:', error);
    return "Your consistent tracking is building great health habits! Keep up the good work.";
  }
}

// Get overall health summary
async function getOverallHealthSummary() {
  const allMeals = mealsLogged;
  const uniqueDates = new Set(mealsLogged.map(meal => meal.date));
  const totalDays = uniqueDates.size;
  const totalSugar = getTotalSugar(allMeals);
  const avgDailySugar = totalDays > 0 ? Math.round(totalSugar / totalDays) : 0;
  const totalCalories = allMeals.reduce((sum, meal) => sum + meal.calories, 0);
  const avgDailyCalories = totalDays > 0 ? Math.round(totalCalories / totalDays) : 0;

  // Calculate average steps (simplified)
  const avgSteps = Math.round(stepCount * (totalDays > 0 ? totalDays / 7 : 1)); // Rough estimate

  const prompt = `Provide a brief overall health summary (max 3 sentences) based on this data:
- Total tracking days: ${totalDays}
- Total meals logged: ${allMeals.length}
- Average daily steps: ${avgSteps.toLocaleString()}
- Average daily sugar: ${avgDailySugar}g
- Average daily calories: ${avgDailyCalories}

Highlight positive trends and encourage consistency. Be motivational and focus on long-term benefits.`;

  try {
    const response = await fetch('http://localhost:5000/chat', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: prompt })
    });

    const data = await response.json();
    return data.reply || "You're building excellent health tracking habits! Consistency is key to long-term wellness success.";
  } catch (error) {
    console.error('Error getting overall summary:', error);
    return "Your dedication to tracking is creating a solid foundation for better health outcomes!";
  }
}

// Check if user is already logged in on page load
document.addEventListener('DOMContentLoaded', function() {
  const storedUserData = JSON.parse(localStorage.getItem('valdoUserData'));

  if (storedUserData) {
    // User is logged in, show dashboard
    initializeStepCounter();
    updateDashboard();
    showScreen('mainDashboard');

    // Show weight input modal if it's a new day
    const today = new Date().toDateString();
    const lastWeightInput = localStorage.getItem('valdoLastWeightInput');
    if (lastWeightInput !== today) {
      setTimeout(showWeightInputModal, 1000);
    }
  } else {
    // No user data, show welcome screens
    setTimeout(() => showScreen('welcome1'), 100);
    setTimeout(() => showScreen('welcome2'), 3000);
    setTimeout(() => showScreen('welcome3'), 6000);
    setTimeout(() => showScreen('welcomeFinal'), 9000);
  }

  // Initialize AI Coach chat functionality
  initializeAIChat();
});

function initializeAIChat() {
  const chatBox = document.getElementById("chat");
  const input = document.getElementById("userInput");
  const sendBtn = document.getElementById("sendBtn");

  function appendMessage(text, who = "bot") {
    const msg = document.createElement("div");
    msg.className = `msg ${who}`;
    const bubble = document.createElement("div");
    bubble.className = "bubble";
    bubble.innerText = text;
    msg.appendChild(bubble);
    chatBox.appendChild(msg);
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  async function sendMessage() {
    const text = input.value.trim();
    if (!text) return;

    appendMessage(text, "user");
    input.value = "";
    appendMessage("Thinking...", "bot");

    try {
      const response = await fetch('http://localhost:5000/chat', {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text })
      });

      const data = await response.json();
      chatBox.lastChild.remove(); // remove "Thinking..."

      if (data.error) {
        appendMessage("Error: " + data.error, "bot");
      } else {
        appendMessage(data.reply, "bot");
      }
    } catch (error) {
      chatBox.lastChild.remove();
      appendMessage("Network error. Check if the server is running on localhost:5000", "bot");
      console.error(error);
    }
  }

  if (sendBtn) {
    sendBtn.addEventListener("click", sendMessage);
  }
  if (input) {
    input.addEventListener("keydown", e => {
      if (e.key === "Enter") sendMessage();
    });
  }
}

// Camera functionality
async function startCamera() {
  try {
    const video = document.getElementById('cameraPreview');
    const constraints = {
      video: {
        facingMode: currentCamera,
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    };

    currentStream = await navigator.mediaDevices.getUserMedia(constraints);
    video.srcObject = currentStream;

    // Hide scan results and errors when starting camera
    document.getElementById('scanResult').style.display = 'none';
    document.getElementById('scanError').style.display = 'none';

  } catch (error) {
    console.error('Error starting camera:', error);
    alert('Could not access camera. Please ensure you have granted camera permissions.');
  }
}

function stopCamera() {
  if (currentStream) {
    currentStream.getTracks().forEach(track => track.stop());
    currentStream = null;
  }
}

function switchCamera() {
  currentCamera = currentCamera === 'environment' ? 'user' : 'environment';
  stopCamera();
  startCamera();
}

function capturePhoto() {
  const video = document.getElementById('cameraPreview');
  const canvas = document.getElementById('photoCanvas');
  const context = canvas.getContext('2d');

  // Set canvas dimensions to match video
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  // Draw current video frame to canvas
  context.drawImage(video, 0, 0, canvas.width, canvas.height);

  // Convert to base64
  const imageData = canvas.toDataURL('image/jpeg', 0.8);

  // Stop camera and process image
  stopCamera();
  processNutritionScan(imageData);
}

async function processNutritionScan(imageData) {
  const captureBtn = document.getElementById('captureBtn');
  const originalText = captureBtn.innerHTML;

  // Show loading state
  captureBtn.innerHTML = '<div class="loading"></div>';
  captureBtn.disabled = true;

  try {
    const response = await fetch('http://localhost:5000/scan-nutrition', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image: imageData })
    });

    const data = await response.json();

    if (data.success) {
      displayScanResults(data.nutrition_data);
    } else {
      showScanError(data.error);
    }
  } catch (error) {
    console.error('Scan error:', error);
    showScanError('Network error. Please check your connection and try again.');
  } finally {
    captureBtn.innerHTML = originalText;
    captureBtn.disabled = false;
  }
}

function displayScanResults(nutritionData) {
  const resultDiv = document.getElementById('scanResult');
  const nutritionDiv = document.getElementById('nutritionData');

  let html = '';
  for (const [key, value] of Object.entries(nutritionData)) {
    if (value !== null) {
      const formattedKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
      html += `<div class="nutrition-item">
        <span>${formattedKey}:</span>
        <strong>${value}</strong>
      </div>`;
    }
  }

  nutritionDiv.innerHTML = html;
  resultDiv.style.display = 'block';

  // Store the scanned data for confirmation
  window.currentScanData = nutritionData;
}

function showScanError(message) {
  const errorDiv = document.getElementById('scanError');
  const errorMessage = document.getElementById('errorMessage');

  errorMessage.textContent = message;
  errorDiv.style.display = 'block';
}

function retryScan() {
  // Hide results and errors
  document.getElementById('scanResult').style.display = 'none';
  document.getElementById('scanError').style.display = 'none';

  // Restart camera
  startCamera();
}

function confirmScan() {
  if (!window.currentScanData) return;

  const nutrition = window.currentScanData;

  // Create meal object directly from scanned data
  const meal = {
    type: 'snack', // Default type, user can change if needed
    description: `Scanned food item${nutrition.serving_size ? ` (${nutrition.serving_size})` : ''}`,
    calories: nutrition.calories || 0,
    carbs: nutrition.carbohydrates || 0,
    protein: nutrition.protein || 0,
    fat: nutrition.fat || 0,
    sugar: nutrition.sugar || 0,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    date: new Date().toISOString().split('T')[0]
  };

  // Add the meal directly
  mealsLogged.push(meal);
  saveMeals();

  // Show success message
  const successMessage = `Meal logged successfully from scan!<br><br>
    <strong>${meal.type.charAt(0).toUpperCase() + meal.type.slice(1)}</strong><br>
    ${meal.description}<br>
    ${meal.calories} calories | Sugar: ${meal.sugar}g | Carbs: ${meal.carbs}g | Protein: ${meal.protein}g | Fat: ${meal.fat}g`;

  showSuccessModal(successMessage);

  // Update dashboard and navigate
  updateDashboard();

  // Clear scanned data
  window.currentScanData = null;
}

function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach((screen) => {
    screen.classList.remove('active');
  });
  const targetScreen = document.getElementById(screenId);
  if (targetScreen) {
    targetScreen.classList.add('active');

    // Start camera when camera screen is shown
    if (screenId === 'cameraScan') {
      setTimeout(startCamera, 100);
    } else {
      // Stop camera when leaving camera screen
      stopCamera();
    }

    // Update dashboard when showing main dashboard
    if (screenId === 'mainDashboard') {
      updateDashboard();
    }

    // Update manual log form when showing meal log
    if (screenId === 'mealLog') {
      setTimeout(updateManualLogForm, 100);
    }

    // Update metrics when showing metrics screen
    if (screenId === 'metrics') {
      setTimeout(updateMetricsScreen, 100);
    }
  }
}

function handleSignIn(event) {
  event.preventDefault();

  const email = document.getElementById('signinEmail').value;
  const password = document.getElementById('signinPassword').value;

  // In a real app, you'd verify credentials
  // For demo, we'll use localStorage data or create demo data
  const storedUser = JSON.parse(localStorage.getItem('valdoUserData'));

  if (storedUser && storedUser.email === email) {
    // User exists in localStorage
    userData = storedUser;
    mealsLogged = JSON.parse(localStorage.getItem('valdoMeals')) || [];
    isFirstTimeUser = localStorage.getItem('valdoFirstTimeUser') === 'true';
  } else {
    // Create demo user (for first time sign in)
    userData = {
      name: email.split('@')[0].charAt(0).toUpperCase() + email.split('@')[0].slice(1),
      email: email,
      age: 30,
      gender: 'male',
      height: 175,
      weight: 75,
      healthStatus: 'healthy',
      goal: 'healthy_lifestyle',
    };
    saveUserData();
    isFirstTimeUser = true;
    saveFirstTimeUser();
  }

  initializeStepCounter();
  updateDashboard();
  showScreen('mainDashboard');

  // Show weight input modal if it's a new day
  const today = new Date().toDateString();
  const lastWeightInput = localStorage.getItem('valdoLastWeightInput');
  if (lastWeightInput !== today) {
    setTimeout(showWeightInputModal, 1000);
  }
}

function handleSignUp(event) {
  event.preventDefault();

  userData = {
    name: document.getElementById('signupName').value,
    age: parseInt(document.getElementById('signupAge').value),
    gender: document.getElementById('signupGender').value,
    height: parseInt(document.getElementById('signupHeight').value),
    weight: parseInt(document.getElementById('signupWeight').value),
    healthStatus: document.getElementById('signupHealthStatus').value,
    goal: document.getElementById('signupGoal').value,
    email: document.getElementById('signupEmail').value,
  };

  isFirstTimeUser = true;

  // Save to localStorage
  saveUserData();
  saveFirstTimeUser();

  initializeStepCounter();
  showScreen('tutorial');
}

function showWeightInputModal() {
  document.getElementById('weightModal').classList.add('active');
}

function skipWeightInput() {
  document.getElementById('weightModal').classList.remove('active');
  // Save today's date to avoid showing the modal again today
  localStorage.setItem('valdoLastWeightInput', new Date().toDateString());
  showScreen('mainDashboard');
}

function saveWeightInput() {
  const weight = document.getElementById('morningWeight').value;
  const height = document.getElementById('morningHeight').value;

  if (weight) userData.weight = parseFloat(weight);
  if (height) userData.height = parseFloat(height);

  saveUserData(); // Save changes to localStorage

  // Save today's date to avoid showing the modal again today
  localStorage.setItem('valdoLastWeightInput', new Date().toDateString());

  document.getElementById('weightModal').classList.remove('active');
  updateDashboard();
  showScreen('mainDashboard');
}

function showManualLog() {
  const options = document.getElementById('mealLogOptions');
  const form = document.getElementById('manualLogForm');
  if (options) options.style.display = 'none';
  if (form) form.classList.add('active');
}

function hideManualLog() {
  const options = document.getElementById('mealLogOptions');
  const form = document.getElementById('manualLogForm');
  if (options) options.style.display = 'grid';
  if (form) form.classList.remove('active');
}

// Update the manual log form to include sugar input
function updateManualLogForm() {
  const manualForm = document.getElementById('manualLogForm');
  if (manualForm) {
    // Check if sugar field already exists
    if (!document.getElementById('mealSugar')) {
      const sugarField = `
        <div class="form-group">
          <label>Sugar (g)</label>
          <input
            type="number"
            id="mealSugar"
            placeholder="e.g., 15"
            min="0"
          />
        </div>
      `;
      // Insert sugar field after carbs field
      const carbsField = manualForm.querySelector('#mealCarbs');
      if (carbsField) {
        carbsField.parentNode.insertAdjacentHTML('afterend', sugarField);
      }
    }
  }
}

function submitMealLog(event) {
  event.preventDefault();
  console.log('Submit meal log function called');

  const meal = {
    type: document.getElementById('mealType').value,
    description: document.getElementById('mealDescription').value,
    calories: parseInt(document.getElementById('mealCalories').value) || 0,
    carbs: parseInt(document.getElementById('mealCarbs').value) || 0,
    protein: parseInt(document.getElementById('mealProtein').value) || 0,
    fat: parseInt(document.getElementById('mealFat').value) || 0,
    sugar: parseInt(document.getElementById('mealSugar').value) || 0,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    date: new Date().toISOString().split('T')[0]
  };

  console.log('Meal to be logged:', meal);

  mealsLogged.push(meal);
  saveMeals(); // Save to localStorage
  console.log('Meals after logging:', mealsLogged);

  // Reset form
  const form = document.getElementById('manualLogForm');
  if (form) form.reset();
  hideManualLog();

  // Show success modal with meal details
  const successMessage = `Meal logged successfully!<br><br>
    <strong>${meal.type.charAt(0).toUpperCase() + meal.type.slice(1)}</strong><br>
    ${meal.description}<br>
    ${meal.calories} calories | Sugar: ${meal.sugar}g | Carbs: ${meal.carbs}g | Protein: ${meal.protein}g | Fat: ${meal.fat}g`;

  showSuccessModal(successMessage);
  console.log('Success modal shown');

  // Force update dashboard immediately
  setTimeout(() => {
    updateDashboard();
    console.log('Dashboard updated after meal log');
  }, 100);
}

function showSuccessModal(message) {
  const modal = document.getElementById('successModal');
  const messageElement = document.getElementById('successMessage');

  console.log('Showing success modal:', modal, messageElement);

  if (modal && messageElement) {
    messageElement.innerHTML = message;
    modal.classList.add('active');
    console.log('Success modal activated');

    // Add event listener for backdrop click
    modal.addEventListener('click', function(e) {
      if (e.target === modal) {
        closeSuccessModal();
      }
    });
  } else {
    console.error('Success modal elements not found:', {
      modal: modal,
      messageElement: messageElement
    });
  }
}

function closeSuccessModal() {
  const modal = document.getElementById('successModal');
  if (modal) {
    modal.classList.remove('active');
    console.log('Success modal closed');
  }

  // Navigate based on user type
  if (isFirstTimeUser && mealsLogged.length === 1) {
    // First-time user's first meal - go to celebration
    showScreen('celebration');
  } else {
    // Regular user or subsequent meals - go to dashboard
    navigateTo('mainDashboard');
  }
}

function completeTutorial() {
  isFirstTimeUser = false;
  saveFirstTimeUser();
  updateDashboard();
  showScreen('mainDashboard');
}

// Enhanced updateDashboard function
async function updateDashboard() {
  if (!userData) {
    console.log('No user data for dashboard update');
    return;
  }

  const todaysMeals = getTodaysMeals();
  console.log('Updating dashboard with meals:', todaysMeals);

  // Update user name
  const userName = document.getElementById('userName');
  if (userName) {
    userName.textContent = userData.name.split(' ')[0];
  }

  // Update empowering message
  const messages = [
    "You're doing amazing! Keep up the great work!",
    'Every step counts towards a healthier you!',
    "You're making great progress today!",
    "Stay strong, you've got this!",
    'Your health journey is inspiring!',
  ];
  const empoweringMessage = document.getElementById('empoweringMessage');
  if (empoweringMessage) {
    empoweringMessage.textContent = messages[Math.floor(Math.random() * messages.length)];
  }

  // Update stats
  updateStepDisplay();

  const totalCalories = todaysMeals.reduce((sum, meal) => sum + meal.calories, 0);
  const caloriesGained = document.getElementById('caloriesGained');
  if (caloriesGained) caloriesGained.textContent = totalCalories;

  // Estimate calories burnt (simplified formula: steps * 0.04)
  const estimatedCaloriesBurnt = Math.round(stepCount * 0.04);
  const caloriesBurnt = document.getElementById('caloriesBurnt');
  if (caloriesBurnt) caloriesBurnt.textContent = estimatedCaloriesBurnt;

  // Replace streak with sugar intake
  const totalSugar = getTotalSugar(todaysMeals);
  const streakCount = document.getElementById('streakCount');
  if (streakCount) {
    streakCount.textContent = `${totalSugar}g`;
    // Add color coding for sugar intake
    if (totalSugar > 50) {
      streakCount.className = 'value sugar-warning';
    } else if (totalSugar > 25) {
      streakCount.className = 'value sugar-moderate';
    } else {
      streakCount.className = 'value sugar-good';
    }
  }

  // Update meal log container to show sugar
  const container = document.getElementById('mealLogContainer');
  if (container) {
    if (todaysMeals.length > 0) {
      let mealsHTML = '';
      todaysMeals.forEach((meal) => {
        const sugarClass = meal.sugar > 20 ? 'sugar-warning' : meal.sugar > 10 ? 'sugar-moderate' : 'sugar-good';
        mealsHTML += `
          <div class="meal-item">
            <h4>${meal.type.charAt(0).toUpperCase() + meal.type.slice(1)} - ${meal.time}</h4>
            <p>${meal.description}</p>
            <p style="font-weight: 600; margin-top: 5px;">
              ${meal.calories} cal | 
              <span class="${sugarClass}">Sugar: ${meal.sugar}g</span> | 
              Carbs: ${meal.carbs}g | 
              Protein: ${meal.protein}g | 
              Fat: ${meal.fat}g
            </p>
          </div>
        `;
      });
      mealsHTML += '<button class="btn-add-meal" onclick="navigateTo(\'mealLog\')">Log Another Meal</button>';
      container.innerHTML = mealsHTML;
    } else {
      container.innerHTML = `
        <div class="meal-log-empty">
          <div class="icon">🍽</div>
          <p>No meals logged yet today</p>
          <button class="btn-add-meal" onclick="navigateTo('mealLog')">Log Your First Meal</button>
        </div>
      `;
    }
  }

  // Update AI feedback with today's data
  const aiFeedback = document.getElementById('aiFeedback');
  if (aiFeedback) {
    aiFeedback.textContent = "Getting today's insights...";
    const feedback = await getTodaysFeedback();
    aiFeedback.textContent = feedback;
  }

  // Update progress
  const progress = Math.min((todaysMeals.length / 3) * 100, 100);
  const progressBar = document.getElementById('progressBar');
  if (progressBar) progressBar.style.width = progress + '%';

  const progressPercent = document.getElementById('progressPercent');
  if (progressPercent) progressPercent.textContent = Math.round(progress);

  const progressText = document.getElementById('progressText');
  if (progressText) {
    if (todaysMeals.length >= 3) {
      progressText.textContent = "Excellent! You've logged all your meals today!";
    } else {
      progressText.textContent = `${todaysMeals.length}/3 meals logged today. Keep going!`;
    }
  }

  console.log('Dashboard update completed');
}

// Enhanced metrics screen with AI insight and comprehensive data
async function updateMetricsScreen() {
  const todaysMeals = getTodaysMeals();
  const allMeals = mealsLogged;
  const uniqueDates = new Set(mealsLogged.map(meal => meal.date));
  const totalDays = uniqueDates.size;
  const trackingStartDate = mealsLogged.length > 0 ?
    new Date(Math.min(...mealsLogged.map(m => new Date(m.date)))) : new Date();

  // Calculate comprehensive metrics
  const totalCalories = allMeals.reduce((sum, meal) => sum + meal.calories, 0);
  const avgDailyCalories = totalDays > 0 ? Math.round(totalCalories / totalDays) : 0;
  const totalSugar = getTotalSugar(allMeals);
  const avgDailySugar = totalDays > 0 ? Math.round(totalSugar / totalDays) : 0;
  const totalCarbs = allMeals.reduce((sum, meal) => sum + (meal.carbs || 0), 0);
  const totalProtein = allMeals.reduce((sum, meal) => sum + (meal.protein || 0), 0);
  const totalFat = allMeals.reduce((sum, meal) => sum + (meal.fat || 0), 0);

  // Calculate averages
  const avgDailyCarbs = totalDays > 0 ? Math.round(totalCarbs / totalDays) : 0;
  const avgDailyProtein = totalDays > 0 ? Math.round(totalProtein / totalDays) : 0;
  const avgDailyFat = totalDays > 0 ? Math.round(totalFat / totalDays) : 0;

  // Calculate average steps (using recent data)
  const avgSteps = Math.round(stepCount * (totalDays > 0 ? Math.min(totalDays / 7, 1) : 1));

  // Update current stats with BMI calculation
  const currentWeight = document.getElementById('currentWeight');
  if (currentWeight && userData.weight) {
    currentWeight.textContent = `${userData.weight} kg`;
    currentWeight.className = 'metric-value';
  }

  const currentHeight = document.getElementById('currentHeight');
  if (currentHeight && userData.height) {
    currentHeight.textContent = `${userData.height} cm`;
    currentHeight.className = 'metric-value';
  }

  const currentBMI = document.getElementById('currentBMI');
  if (currentBMI && userData.weight && userData.height) {
    const bmi = (userData.weight / ((userData.height / 100) ** 2)).toFixed(1);
    currentBMI.textContent = bmi;
    currentBMI.className = 'metric-value';

    // Add BMI classification
    let bmiClass = 'bmi-normal';
    if (bmi < 18.5) bmiClass = 'bmi-underweight';
    else if (bmi < 25) bmiClass = 'bmi-normal';
    else if (bmi < 30) bmiClass = 'bmi-overweight';
    else bmiClass = 'bmi-obese';

    currentBMI.classList.add(bmiClass);
  }

  // Update weekly summary with comprehensive data
  updateMetricElement('Average Steps', avgSteps.toLocaleString());
  updateMetricElement('Average Calories In', avgDailyCalories.toLocaleString());
  updateMetricElement('Average Calories Out', Math.round(avgSteps * 0.04).toLocaleString());

  // Add new metrics
  updateMetricElement('Average Sugar Intake', `${avgDailySugar}g`);
  updateMetricElement('Average Carbs', `${avgDailyCarbs}g`);
  updateMetricElement('Average Protein', `${avgDailyProtein}g`);
  updateMetricElement('Average Fat', `${avgDailyFat}g`);

  // Add sugar level indicator
  const sugarElement = document.querySelector('.profile-item span:contains("Average Sugar Intake")');
  if (sugarElement) {
    const sugarValue = sugarElement.nextElementSibling;
    if (avgDailySugar > 50) {
      sugarValue.classList.add('sugar-high');
    } else if (avgDailySugar > 25) {
      sugarValue.classList.add('sugar-moderate');
    } else {
      sugarValue.classList.add('sugar-low');
    }
  }

  // Update goals progress with actual data
  const stepGoal = 10000;
  const stepProgress = Math.min((stepCount / stepGoal) * 100, 100);
  const mealGoal = 3;
  const mealProgress = Math.min((todaysMeals.length / mealGoal) * 100, 100);

  // Update progress bars
  updateProgressBar('.progress-bar-container:first-child .progress-bar', stepProgress);
  updateProgressBar('.progress-bar-container:last-child .progress-bar', mealProgress);

  // Update progress labels
  updateProgressLabel('.progress-bar-container:first-child', `Steps: ${stepCount.toLocaleString()} / ${stepGoal.toLocaleString()}`);
  updateProgressLabel('.progress-bar-container:last-child', `Meals: ${todaysMeals.length} / ${mealGoal}`);

  // Update profile screen
  updateProfileScreen();

  // Update overall AI insight
  await updateOverallAIInsight({
    totalDays,
    totalMeals: allMeals.length,
    avgSteps,
    avgDailyCalories,
    avgDailySugar,
    avgDailyCarbs,
    avgDailyProtein,
    avgDailyFat,
    stepGoalProgress: stepProgress,
    mealGoalProgress: mealProgress,
    bmi: userData.weight && userData.height ? (userData.weight / ((userData.height / 100) ** 2)).toFixed(1) : null,
    healthStatus: userData.healthStatus,
    mainGoal: userData.goal
  });
}

// Helper function to update metric elements
function updateMetricElement(label, value) {
  const elements = document.querySelectorAll('.profile-item span');
  elements.forEach(element => {
    if (element.textContent.includes(label)) {
      element.nextElementSibling.textContent = value;
    }
  });
}

// Helper function to update progress bars
function updateProgressBar(selector, progress) {
  const progressBar = document.querySelector(selector);
  if (progressBar) {
    progressBar.style.width = `${progress}%`;

    // Color coding based on progress
    if (progress >= 100) {
      progressBar.style.background = 'var(--success-color)';
    } else if (progress >= 75) {
      progressBar.style.background = 'var(--primary-gradient)';
    } else if (progress >= 50) {
      progressBar.style.background = 'linear-gradient(135deg, #ffd89b 0%, #19547b 100%)';
    } else {
      progressBar.style.background = 'var(--error-color)';
    }
  }
}

// Helper function to update progress labels
function updateProgressLabel(containerSelector, text) {
  const container = document.querySelector(containerSelector);
  if (container) {
    const label = container.querySelector('p:last-child');
    if (label) {
      label.textContent = text;
    }
  }
}

// New function for overall AI insight
async function updateOverallAIInsight(metrics) {
  const insightElement = document.getElementById('overallInsightText');
  if (!insightElement) return;

  insightElement.textContent = "Analyzing your health patterns...";

  const prompt = `Provide a comprehensive but concise overall lifestyle assessment (max 3-4 sentences) based on this data:

Tracking Duration: ${metrics.totalDays} days
Total Meals Logged: ${metrics.totalMeals}
Average Daily Steps: ${metrics.avgSteps.toLocaleString()}
Average Daily Calories: ${metrics.avgDailyCalories}
Average Daily Sugar: ${metrics.avgDailySugar}g
Average Daily Carbs: ${metrics.avgDailyCarbs}g
Average Daily Protein: ${metrics.avgDailyProtein}g
Average Daily Fat: ${metrics.avgDailyFat}g
Step Goal Progress: ${Math.round(metrics.stepGoalProgress)}%
Meal Logging Consistency: ${Math.round(metrics.mealGoalProgress)}%
BMI: ${metrics.bmi || 'Not available'}
Health Status: ${metrics.healthStatus}
Main Goal: ${metrics.mainGoal}

Provide an overall assessment of lifestyle habits, highlight strengths and areas for improvement, and give one key recommendation. Be encouraging but honest. Focus on patterns and long-term health.`;

  try {
    const response = await fetch('http://localhost:5000/chat', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: prompt })
    });

    const data = await response.json();
    insightElement.textContent = data.reply || "Your consistent tracking shows great commitment to health! Keep maintaining balanced nutrition and regular activity for long-term wellness.";
    console.log(data.reply)
  } catch (error) {
    console.error('Error getting overall insight:', error);
    insightElement.textContent = "Your health tracking dedication is impressive! Regular monitoring helps build sustainable healthy habits for lifelong wellness.";
  }
}

// Add this helper function to calculate trends
function calculateTrend(current, previous) {
  if (previous === 0) return 'neutral';
  const change = ((current - previous) / previous) * 100;
  if (change > 5) return 'up';
  if (change < -5) return 'down';
  return 'neutral';
}

// Update profile screen with actual data
function updateProfileScreen() {
  if (!userData) return;

  const profileName = document.getElementById('profileName');
  if (profileName) profileName.textContent = userData.name;

  const profileEmail = document.getElementById('profileEmail');
  if (profileEmail) profileEmail.textContent = userData.email;

  const profileAge = document.getElementById('profileAge');
  if (profileAge) profileAge.textContent = userData.age;

  const profileGender = document.getElementById('profileGender');
  if (profileGender) profileGender.textContent = userData.gender;

  const profileHeight = document.getElementById('profileHeight');
  if (profileHeight) profileHeight.textContent = `${userData.height} cm`;

  const profileWeight = document.getElementById('profileWeight');
  if (profileWeight) profileWeight.textContent = `${userData.weight} kg`;

  const profileHealthStatus = document.getElementById('profileHealthStatus');
  if (profileHealthStatus) profileHealthStatus.textContent = userData.healthStatus;

  const profileGoal = document.getElementById('profileGoal');
  if (profileGoal) profileGoal.textContent = userData.goal;
}

function navigateTo(screenId) {
  console.log('Navigating to:', screenId);
  document.querySelectorAll('.screen').forEach((screen) => {
    screen.classList.remove('active');
  });
  const targetScreen = document.getElementById(screenId);
  if (targetScreen) {
    targetScreen.classList.add('active');

    // Start camera when camera screen is shown
    if (screenId === 'cameraScan') {
      setTimeout(startCamera, 100);
    } else {
      // Stop camera when leaving camera screen
      stopCamera();
    }

    // Update dashboard when showing main dashboard
    if (screenId === 'mainDashboard') {
      setTimeout(updateDashboard, 100);
    }

    // Update metrics when showing metrics screen
    if (screenId === 'metrics') {
      setTimeout(updateMetricsScreen, 100);
    }
  }

  // Update nav items
  document.querySelectorAll('.nav-item').forEach((item) => {
    item.classList.remove('active');
  });

  const activeNavItem = document.querySelector(`.nav-item[onclick*="${screenId}"]`);
  if (activeNavItem) {
    activeNavItem.classList.add('active');
  }
}

function handleLogout() {
  if (confirm('Are you sure you want to log out?')) {
    clearUserData();
    showScreen('welcome1');

    setTimeout(() => showScreen('welcome2'), 3000);
    setTimeout(() => showScreen('welcome3'), 6000);
    setTimeout(() => showScreen('welcomeFinal'), 9000);
  }
}