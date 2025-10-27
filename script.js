// ===================================
// 1. FIREBASE SETUP
// ===================================

// Import the functions you need from the Modular SDKs
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, signInAnonymously, signOut } from "firebase/auth"; // NEW: For authentication logic
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore"; // NEW: For database access

// Your web app's Firebase configuration (Noa's Tracker)
const firebaseConfig = {
  apiKey: "AIzaSyArcbWyj9mDznmL1Dyb1CAqDAcM3jbhXpo",
  authDomain: "noa-s-tracker.firebaseapp.com",
  projectId: "noa-s-tracker",
  storageBucket: "noa-s-tracker.firebasestorage.app",
  messagingSenderId: "759205644605",
  appId: "1:759205644605:web:16bbc5e3862db566c55d54",
  measurementId: "G-5S36FG9GLW"
};

// Initialize Firebase services
const app = initializeApp(firebaseConfig);
const db = getFirestore(app); // Initialized Firestore service
const auth = getAuth(app); // Initialized Auth service
const analytics = getAnalytics(app);

// The document reference will be set after sign-in.
// We are keeping the original fixed path structure for shared access.
let trackerDocRef = null;

// ===================================
// 2. DOM ELEMENTS AND INITIAL STATE
// ===================================

// CONVERTED TO LET and initialized to null to allow assignment inside setupDOMReferences()
let calendar = null;
let currentMonthYear = null;
let prevMonthBtn = null;
let nextMonthBtn = null;
let overlay = null;
let overlayWeekTitle = null;
let closeOverlayBtn = null;
let statusButtons = null;
let starsCountElem = null;
let unicornsCountElem = null;
let streakCountElem = null;

let bonusStarsContainer = null;
let bonusStarsPicker = null;
let confirmBonusBtn = null;

// Start date used for calculating week numbers
const START_DATE = new Date('2025-09-08');
let currentDate = new Date('2025-09-08');
let currentWeekData = {};
let data = {}; 

// ===================================
// 3. CORE FUNCTIONS (LOAD/SAVE/RENDER)
// ===================================

/**
 * Loads data from Firestore using the modern SDK.
 */
async function loadData() {
    if (!trackerDocRef) {
        console.error("Tracker document reference is not defined.");
        return;
    }
    try {
        const docSnap = await getDoc(trackerDocRef); // Use getDoc instead of trackerRef.get()
        if (docSnap.exists()) {
            // Data is stored under the 'weeks' field in the document
            data = docSnap.data().weeks || {};
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
 * Saves the current data object to Firestore using the modern SDK.
 */
async function saveData() {
    if (!trackerDocRef) {
        console.error("Tracker document reference is not defined. Cannot save.");
        return;
    }
    // Save data to Firebase
    try {
        // Use setDoc instead of trackerRef.set()
        await setDoc(trackerDocRef, { weeks: data });
        console.log("Data saved to Firebase.");
    } catch (error) {
        console.error("Error saving data to Firebase:", error);
    }

    // Always update stats and render UI after saving
    updateStats();
    renderCalendar();
}


function generateBonusStars() {
    if (!bonusStarsPicker) {
        console.error("Cannot generate bonus stars. Picker element is missing.");
        return;
    }

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

function updateStats() {
    // Stat elements must be checked here as well
    if (!starsCountElem || !unicornsCountElem || !streakCountElem) {
        console.error("Stat elements not initialized. Skipping stat update.");
        return;
    }

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
    // Check elements *before* trying to manipulate them
    if (!calendar || !currentMonthYear || !prevMonthBtn || !nextMonthBtn) {
        console.error("Cannot render calendar. Critical DOM elements are missing. DOM elements must be available before this is called.");
        return;
    }

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
    if (!overlay || !overlayWeekTitle || !statusButtons || !bonusStarsContainer) {
        console.error("Cannot show overlay. Critical DOM elements are missing.");
        return;
    }
    
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
// 4. DOM SETUP & EVENT LISTENERS REFACTOR
// ===================================

/**
 * Initializes all global DOM references after the document structure is loaded.
 */
function setupDOMReferences() {
    calendar = document.getElementById('calendar');
    currentMonthYear = document.getElementById('current-month-year');
    prevMonthBtn = document.getElementById('prev-month-btn');
    nextMonthBtn = document.getElementById('next-month-btn');
    overlay = document.getElementById('overlay');
    overlayWeekTitle = document.getElementById('overlay-week-title');
    closeOverlayBtn = document.getElementById('close-overlay-btn');
    // Note: querySelectorAll must run after DOM is ready
    statusButtons = document.querySelectorAll('.btn-status'); 
    starsCountElem = document.getElementById('stars-count');
    unicornsCountElem = document.getElementById('unicorns-count');
    streakCountElem = document.getElementById('streak-count');

    bonusStarsContainer = document.getElementById('bonus-stars-container');
    bonusStarsPicker = document.getElementById('bonus-stars-picker');
    confirmBonusBtn = document.getElementById('confirm-bonus-btn');

    if (!calendar) {
        // CRITICAL: If the calendar element is missing, we must log an error and halt rendering
        console.error("CRITICAL ERROR: 'calendar' element (ID='calendar') not found. Check HTML structure.");
        return false; // Indicate failure
    }
    return true; // Indicate success
}

/**
 * Attaches all necessary event listeners to the DOM elements.
 */
function setupEventListeners() {
    // We already checked for missing elements in setupDOMReferences, but a quick check here is good
    if (!statusButtons || !confirmBonusBtn || !closeOverlayBtn || !prevMonthBtn || !nextMonthBtn) {
        console.error("Cannot set up event listeners. One or more critical elements are null. Skipping event setup.");
        return;
    }

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
}

// ===================================
// 5. AUTHENTICATION AND INITIAL DATA LOAD
// ===================================

/**
 * Handles Firebase Authentication and sets up the document reference.
 */
async function initializeAuthAndData() {
    try {
        // CRUCIAL: Force sign out to ensure a new anonymous ID is generated 
        await signOut(auth); 
        
        // Sign in anonymously
        const userCredential = await signInAnonymously(auth);
        
        // Define the fixed document reference
        trackerDocRef = doc(db, "trackers", "NoaLaviTracker");

        console.log("Signed in with new User ID:", userCredential.user.uid);
        
        // Proceed with loading data
        await loadData(); 

    } catch (error) {
        console.error("Firebase Auth initialization failed:", error);
    }
}

// Start the application by waiting for the DOM to be fully loaded.
document.addEventListener('DOMContentLoaded', () => {
    // 1. Get references. If this fails, we cannot proceed with rendering/events.
    if (!setupDOMReferences()) {
        return; 
    }

    // 2. Generate elements (like bonus stars)
    generateBonusStars();
    
    // 3. Attach listeners
    setupEventListeners(); 
    
    // 4. Load data and render UI (which calls renderCalendar and updateStats)
    initializeAuthAndData();
});
