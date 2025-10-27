// ===================================
// 1. FIREBASE SETUP
// ===================================

// Your web app's Firebase configuration (pasted from Firebase Console)
const firebaseConfig = {
  apiKey: "AIzaSyArcbWyj9mDznmL1Dyb1CAqDAcM3jbhXpo",
  authDomain: "noa-s-tracker.firebaseapp.com",
  projectId: "noa-s-tracker",
  storageBucket: "noa-s-tracker.firebasestorage.app",
  messagingSenderId: "759205644605",
  appId: "1:759205644605:web:16bbc5e3862db566c55d54",
  measurementId: "G-5S36FG9GLW"
};

// Initialize Firebase and Firestore (using the global 'firebase' object from the compat scripts)
const app = firebase.initializeApp(firebaseConfig);
const db = app.firestore();
// We use a fixed document ID to ensure all devices access the same tracker data.
const trackerRef = db.collection("trackers").doc("NoaLaviTracker"); 

// ===================================
// 2. DOM ELEMENTS AND INITIAL STATE
// ===================================

const calendar = document.getElementById('calendar');
const currentMonthYear = document.getElementById('current-month-year');
const prevMonthBtn = document.getElementById('prev-month-btn');
const nextMonthBtn = document.getElementById('next-month-btn');
const overlay = document.getElementById('overlay');
const overlayWeekTitle = document.getElementById('overlay-week-title');
const closeOverlayBtn = document.getElementById('close-overlay-btn');
const statusButtons = document.querySelectorAll('.btn-status');
const starsCountElem = document.getElementById('stars-count');
const unicornsCountElem = document.getElementById('unicorns-count');
const streakCountElem = document.getElementById('streak-count');

const bonusStarsContainer = document.getElementById('bonus-stars-container');
const bonusStarsPicker = document.getElementById('bonus-stars-picker');
const confirmBonusBtn = document.getElementById('confirm-bonus-btn');

// Start date used for calculating week numbers
const START_DATE = new Date('2025-09-08');
let currentDate = new Date('2025-09-08');
let currentWeekData = {};
// Data will now be loaded from Firestore instead of localStorage
let data = {}; 

// ===================================
// 3. CORE FUNCTIONS (LOAD/SAVE/RENDER)
// ===================================

/**
 * Loads data from Firestore.
 * This is the new entry point for data retrieval.
 */
async function loadData() {
    try {
        const doc = await trackerRef.get();
        if (doc.exists) {
            // Data is stored under the 'weeks' field in the document
            data = doc.data().weeks || {};
            console.log("Data loaded from Firebase.");
        } else {
            console.log("No existing data in Firebase, initializing empty data object.");
            data = {};
        }
    } catch (error) {
        // If there's an error (e.g., network issue), we just start with empty data
        console.error("Error loading data from Firebase:", error);
    }
    // After loading (or failing to load), render the UI
    renderCalendar();
    updateStats();
}

/**
 * Saves the current data object to Firestore.
 * This replaces the old localStorage.setItem call.
 */
async function saveData() {
    // Save data to Firebase
    try {
        // Use .set() to save the entire 'data' object under the 'weeks' field
        await trackerRef.set({ weeks: data });
        console.log("Data saved to Firebase.");
    } catch (error) {
        console.error("Error saving data to Firebase:", error);
    }

    // Always update stats and render UI after saving
    updateStats();
    renderCalendar();
}


function generateBonusStars() {
    bonusStarsPicker.innerHTML = '';
    for (let i = 1; i <= 5; i++) {
        const star = document.createElement('i');
        star.classList.add('fas', 'fa-star');
        star.dataset.value = i;
        star.addEventListener('click', () => {
            const value = parseInt(star.dataset.value);
            const activeStars = document.querySelectorAll('#bonus-stars-picker .fas.fa-star.active');
            let isAlreadyActive = false;
            activeStars.forEach(s => {
                if (parseInt(s.dataset.value) === value) {
                    isAlreadyActive = true;
                }
            });

            document.querySelectorAll('#bonus-stars-picker .fas.fa-star').forEach(s => s.classList.remove('active'));

            if (!isAlreadyActive || activeStars.length !== value) {
                let currentStar = star;
                while(currentStar) {
                    currentStar.classList.add('active');
                    currentStar = currentStar.previousElementSibling;
                }
            }
        });
        bonusStarsPicker.appendChild(star);
    }
}

generateBonusStars();

function updateStats() {
    let stars = 0;
    let currentStreak = 0;

    const sortedWeeks = Object.keys(data).sort((a, b) => new Date(a) - new Date(b));

    sortedWeeks.forEach(weekStart => {
        const week = data[weekStart];
        const status = week.status;

        if (status === 'complete') {
            stars += 1;
            if (week.bonusStars) {
                stars += week.bonusStars;
            }
            currentStreak++;
        } else if (status === 'partial') {
            stars += 0.5;
            currentStreak++;
        } else if (status === 'none') {
            // No homework status does not affect the streak
        } else if (status === 'nothing-done') {
            currentStreak = 0;
        } else {
            currentStreak = 0;
        }
    });

    const unicorns = Math.floor(stars / 4);
    starsCountElem.textContent = stars;
    unicornsCountElem.textContent = unicorns;
    streakCountElem.textContent = currentStreak;
}

function renderCalendar() {
    calendar.innerHTML = '';
    const startOfWeek = new Date(currentDate);

    const day = startOfWeek.getDay();
    const diff = day === 1 ? 0 : (day === 0 ? 6 : day - 1);
    startOfWeek.setDate(startOfWeek.getDate() - diff);

    const timeDiff = startOfWeek.getTime() - START_DATE.getTime();
    const weekDiff = Math.floor(timeDiff / (7 * 24 * 60 * 60 * 1000));
    const baseWeekNumber = weekDiff + 1;

    for (let i = 0; i < 5; i++) {
        const weekStartDate = new Date(startOfWeek);
        weekStartDate.setDate(startOfWeek.getDate() + i * 7);

        const weekEndDate = new Date(weekStartDate);
        weekEndDate.setDate(weekStartDate.getDate() + 6);

        const weekStartString = weekStartDate.toISOString().split('T')[0];
        const weekData = data[weekStartString] || { status: 'unmarked' };
        
        const weekCard = document.createElement('div');
        weekCard.classList.add('week-card', `status-${weekData.status}`);
        
        const weekNumber = baseWeekNumber + i;

        weekCard.innerHTML = `
            <h3>Week ${weekNumber}</h3>
            <p>${weekStartDate.toLocaleDateString()} - ${weekEndDate.toLocaleDateString()}</p>
        `;

        weekCard.addEventListener('click', () => {
            currentWeekData = {
                weekStart: weekStartString,
                element: weekCard
            };
            showOverlay(weekStartString, weekNumber);
        });

        calendar.appendChild(weekCard);
    }
    
    currentMonthYear.textContent = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
    // Logic to disable prev button if we are at the start date or before
    if (currentDate.getTime() <= START_DATE.getTime() && currentDate.getMonth() === START_DATE.getMonth()) {
        prevMonthBtn.disabled = true;
        prevMonthBtn.style.opacity = 0.5;
        prevMonthBtn.style.cursor = 'not-allowed';
    } else {
        prevMonthBtn.disabled = false;
        prevMonthBtn.style.opacity = 1;
        prevMonthBtn.style.cursor = 'pointer';
    }
}

function showOverlay(weekStart, weekNumber) {
    overlayWeekTitle.textContent = `Week #${weekNumber}`;
    
    // Reset buttons and bonus container
    statusButtons.forEach(button => button.classList.remove('active'));
    bonusStarsContainer.style.display = 'none';
    document.querySelectorAll('#bonus-stars-picker .fas.fa-star').forEach(s => s.classList.remove('active'));

    const weekData = data[weekStart];
    if (weekData) {
        const activeBtn = document.querySelector(`.btn-status[data-status="${weekData.status}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }

        if (weekData.status === 'complete') {
            bonusStarsContainer.style.display = 'block';
            if (weekData.bonusStars) {
                for (let i = 1; i <= weekData.bonusStars; i++) {
                    const star = document.querySelector(`#bonus-stars-picker .fas.fa-star[data-value="${i}"]`);
                    if (star) {
                        star.classList.add('active');
                    }
                }
            }
        }
    }

    overlay.classList.add('visible');
}

// ===================================
// 4. EVENT LISTENERS
// ===================================

statusButtons.forEach(button => {
    button.addEventListener('click', () => {
        const status = button.dataset.status;
        const isAlreadyActive = button.classList.contains('active');
        document.querySelectorAll('.btn-status').forEach(b => b.classList.remove('active'));
        
        bonusStarsContainer.style.display = 'none';

        if (isAlreadyActive) {
            // Clicking an active button removes the status (deletes the data point)
            delete data[currentWeekData.weekStart];
        } else {
            button.classList.add('active');
            if (status === 'complete') {
                // If 'Complete' is selected, show bonus stars picker and wait for confirmation
                bonusStarsContainer.style.display = 'block';
                return; // Do not save yet
            } else {
                // For other statuses, save immediately
                data[currentWeekData.weekStart] = { status: status };
                overlay.classList.remove('visible');
            }
        }
        
        saveData();
    });
});

confirmBonusBtn.addEventListener('click', () => {
    if (currentWeekData.weekStart) {
        const selectedBonusStarsCount = document.querySelectorAll('#bonus-stars-picker .fas.fa-star.active').length;
        // Set the status and the selected bonus stars
        data[currentWeekData.weekStart] = { status: 'complete', bonusStars: selectedBonusStarsCount };
        
        saveData();
        overlay.classList.remove('visible');
    }
});

closeOverlayBtn.addEventListener('click', () => {
    overlay.classList.remove('visible');
});

prevMonthBtn.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() - 1);
    renderCalendar();
});

nextMonthBtn.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
});

// ===================================
// 5. INITIAL DATA LOAD
// ===================================

// Start the application by loading data from the cloud
loadData();
