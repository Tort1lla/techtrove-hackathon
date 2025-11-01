// Get user data from localStorage or use defaults
let userData = JSON.parse(localStorage.getItem('valdoUserData')) || null;
let isFirstTimeUser = localStorage.getItem('valdoFirstTimeUser') === 'true';
let mealsLogged = JSON.parse(localStorage.getItem('valdoMeals')) || [];
let currentStream = null;
let currentCamera = 'environment';

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
  userData = null;
  mealsLogged = [];
  isFirstTimeUser = false;
}

// Get today's meals only
function getTodaysMeals() {
  const today = new Date().toISOString().split('T')[0];
  return mealsLogged.filter(meal => meal.date === today);
}

// Check if user is already logged in on page load
document.addEventListener('DOMContentLoaded', function() {
  const storedUserData = JSON.parse(localStorage.getItem('valdoUserData'));

  if (storedUserData) {
    // User is logged in, show dashboard
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
    ${meal.calories} calories | Carbs: ${meal.carbs}g | Protein: ${meal.protein}g | Fat: ${meal.fat}g`;

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
    ${meal.calories} calories | Carbs: ${meal.carbs}g | Protein: ${meal.protein}g | Fat: ${meal.fat}g`;

  showSuccessModal(successMessage);
  console.log('Success modal shown');

  // Force update dashboard immediately
  setTimeout(() => {
    updateDashboard();
    console.log('Dashboard updated after meal log');
  }, 100);

  // For first-time users, navigate to celebration after modal
  if (isFirstTimeUser && mealsLogged.length === 1) {
    // Remove the automatic navigation and let user click the button
    console.log('First meal logged by new user');
  }
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

function updateDashboard() {
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
  const stepCount = document.getElementById('stepCount');
  if (stepCount) stepCount.textContent = '8,543';

  const totalCalories = todaysMeals.reduce((sum, meal) => sum + meal.calories, 0);
  const caloriesGained = document.getElementById('caloriesGained');
  if (caloriesGained) caloriesGained.textContent = totalCalories;

  const caloriesBurnt = document.getElementById('caloriesBurnt');
  if (caloriesBurnt) caloriesBurnt.textContent = '2,340';

  const streakCount = document.getElementById('streakCount');
  if (streakCount) {
    streakCount.textContent = todaysMeals.length > 0 ? '5' : '0';
  }

  // Update meal log container
  const container = document.getElementById('mealLogContainer');
  if (container) {
    if (todaysMeals.length > 0) {
      let mealsHTML = '';
      todaysMeals.forEach((meal) => {
        mealsHTML += `
          <div class="meal-item">
            <h4>${meal.type.charAt(0).toUpperCase() + meal.type.slice(1)} - ${meal.time}</h4>
            <p>${meal.description}</p>
            <p style="font-weight: 600; color: #667eea; margin-top: 5px;">
              ${meal.calories} cal | Carbs: ${meal.carbs}g | Protein: ${meal.protein}g | Fat: ${meal.fat}g
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

  // Update AI feedback
  const aiFeedback = document.getElementById('aiFeedback');
  if (aiFeedback) {
    if (todaysMeals.length > 0) {
      const lastMeal = todaysMeals[todaysMeals.length - 1];
      aiFeedback.textContent = `Great job logging your ${lastMeal.type}! Your ${lastMeal.calories} calorie meal is well-balanced. Keep up the consistent tracking!`;
    } else {
      aiFeedback.textContent = "Start logging your meals to get personalized feedback!";
    }
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