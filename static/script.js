// Get user data from localStorage or use defaults
let userData = JSON.parse(localStorage.getItem('valdoUserData')) || null;
let isFirstTimeUser = localStorage.getItem('valdoFirstTimeUser') === 'true';
let mealsLogged = JSON.parse(localStorage.getItem('valdoMeals')) || [];

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

function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach((screen) => {
    screen.classList.remove('active');
  });
  const targetScreen = document.getElementById(screenId);
  if (targetScreen) {
    targetScreen.classList.add('active');
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
  showScreen('mainDashboard');
}

function saveWeightInput() {
  const weight = document.getElementById('morningWeight').value;
  const height = document.getElementById('morningHeight').value;

  if (weight) userData.weight = parseFloat(weight);
  if (height) userData.height = parseFloat(height);

  saveUserData(); // Save changes to localStorage
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

  const meal = {
    type: document.getElementById('mealType').value,
    description: document.getElementById('mealDescription').value,
    calories: parseInt(document.getElementById('mealCalories').value),
    carbs: document.getElementById('mealCarbs').value ? parseInt(document.getElementById('mealCarbs').value) : 0,
    protein: document.getElementById('mealProtein').value ? parseInt(document.getElementById('mealProtein').value) : 0,
    fat: document.getElementById('mealFat').value ? parseInt(document.getElementById('mealFat').value) : 0,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    date: new Date().toISOString().split('T')[0] // Store date for filtering
  };

  mealsLogged.push(meal);
  saveMeals(); // Save to localStorage

  const form = document.getElementById('manualLogForm');
  if (form) form.reset();
  hideManualLog();

  if (isFirstTimeUser && mealsLogged.length === 1) {
    showScreen('celebration');
  } else {
    updateDashboard();
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
  if (!userData) return;

  const todaysMeals = getTodaysMeals();

  const userName = document.getElementById('userName');
  if (userName) {
    userName.textContent = userData.name.split(' ')[0];
  }

  const messages = [
    "You're doing amazing! Keep up the great work!",
    'Every step counts towards a healthier you!',
    "You're making great progress today!",
    "Stay strong, you've got this!",
    'Your health journey is inspiring!',
  ];
  const empoweringMessage = document.getElementById('empoweringMessage');
  if (empoweringMessage) {
    empoweringMessage.textContent =
      messages[Math.floor(Math.random() * messages.length)];
  }

  const stepCount = document.getElementById('stepCount');
  if (stepCount) stepCount.textContent = '8,543';

  const totalCalories = todaysMeals.reduce(
    (sum, meal) => sum + meal.calories,
    0
  );
  const caloriesGained = document.getElementById('caloriesGained');
  if (caloriesGained) caloriesGained.textContent = totalCalories;

  const caloriesBurnt = document.getElementById('caloriesBurnt');
  if (caloriesBurnt) caloriesBurnt.textContent = '2,340';

  const streakCount = document.getElementById('streakCount');
  if (streakCount) {
    streakCount.textContent = todaysMeals.length > 0 ? '5' : '0';
  }

  const container = document.getElementById('mealLogContainer');
  if (container) {
    if (todaysMeals.length > 0) {
      container.innerHTML = '';
      todaysMeals.forEach((meal) => {
        container.innerHTML += `
          <div class="meal-item">
            <h4>${meal.type.charAt(0).toUpperCase() + meal.type.slice(1)} - ${meal.time}</h4>
            <p>${meal.description}</p>
            <p style="font-weight: 600; color: #667eea; margin-top: 5px;">
              ${meal.calories} cal | Carbs: ${meal.carbs}g | Protein: ${meal.protein}g | Fat: ${meal.fat}g
            </p>
          </div>
        `;
      });
      container.innerHTML +=
        '<button class="btn-add-meal" onclick="navigateTo(\'mealLog\')">Log Another Meal</button>';
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

  const aiFeedback = document.getElementById('aiFeedback');
  if (aiFeedback && todaysMeals.length > 0) {
    const lastMeal = todaysMeals[todaysMeals.length - 1];
    aiFeedback.textContent = `Great job logging your ${lastMeal.type}! Your ${lastMeal.calories} calorie meal is well-balanced. Keep up the consistent tracking!`;
  }

  const progress = Math.min((todaysMeals.length / 3) * 100, 100);
  const progressBar = document.getElementById('progressBar');
  if (progressBar) progressBar.style.width = progress + '%';

  const progressPercent = document.getElementById('progressPercent');
  if (progressPercent) progressPercent.textContent = Math.round(progress);

  const progressText = document.getElementById('progressText');
  if (progressText) {
    if (todaysMeals.length >= 3) {
      progressText.textContent =
        "Excellent! You've logged all your meals today!";
    } else {
      progressText.textContent = `${todaysMeals.length}/3 meals logged today. Keep going!`;
    }
  }

  const profileName = document.getElementById('profileName');
  if (profileName) profileName.textContent = userData.name;

  const profileEmail = document.getElementById('profileEmail');
  if (profileEmail) profileEmail.textContent = userData.email;

  const profileAge = document.getElementById('profileAge');
  if (profileAge) profileAge.textContent = userData.age;

  const profileGender = document.getElementById('profileGender');
  if (profileGender) {
    profileGender.textContent =
      userData.gender.charAt(0).toUpperCase() + userData.gender.slice(1);
  }

  const profileHeight = document.getElementById('profileHeight');
  if (profileHeight) profileHeight.textContent = userData.height + ' cm';

  const profileWeight = document.getElementById('profileWeight');
  if (profileWeight) profileWeight.textContent = userData.weight + ' kg';

  const profileHealthStatus = document.getElementById('profileHealthStatus');
  if (profileHealthStatus) {
    profileHealthStatus.textContent =
      userData.healthStatus.charAt(0).toUpperCase() +
      userData.healthStatus.slice(1).replace('_', ' ');
  }

  const profileGoal = document.getElementById('profileGoal');
  if (profileGoal) {
    profileGoal.textContent = userData.goal
      .replace('_', ' ')
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }

  const currentWeight = document.getElementById('currentWeight');
  if (currentWeight) currentWeight.textContent = userData.weight + ' kg';

  const currentHeight = document.getElementById('currentHeight');
  if (currentHeight) currentHeight.textContent = userData.height + ' cm';

  const currentBMI = document.getElementById('currentBMI');
  if (currentBMI) {
    const bmi = (userData.weight / ((userData.height / 100) ** 2)).toFixed(1);
    currentBMI.textContent = bmi;
  }

  const profileAvatar = document.getElementById('profileAvatar');
  if (profileAvatar) {
    profileAvatar.textContent = userData.name.charAt(0).toUpperCase();
  }
}

function navigateTo(screenId) {
  showScreen(screenId);

  document.querySelectorAll('.nav-item').forEach((item) => {
    item.classList.remove('active');
  });

  // Set the active nav item
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