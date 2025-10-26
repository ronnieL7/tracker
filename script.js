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

const START_DATE = new Date('2025-09-08');
let currentDate = new Date('2025-09-08');
let currentWeekData = {};
let data = JSON.parse(localStorage.getItem('weeklyHomeworkTracker')) || {};

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

function saveData() {
    localStorage.setItem('weeklyHomeworkTracker', JSON.stringify(data));
    updateStats();
    renderCalendar();
}

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
    
    if (currentDate.getTime() <= START_DATE.getTime()) {
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
    
    statusButtons.forEach(button => button.classList.remove('active'));
    bonusStarsContainer.style.display = 'none';
    document.querySelectorAll('#bonus-stars-picker .fas.fa-star').forEach(s => s.classList.remove('active'));

    const weekData = data[weekStart];
    if (weekData) {
        document.querySelector(`.btn-status[data-status="${weekData.status}"]`).classList.add('active');
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

statusButtons.forEach(button => {
    button.addEventListener('click', () => {
        const status = button.dataset.status;
        const isAlreadyActive = button.classList.contains('active');
        document.querySelectorAll('.btn-status').forEach(b => b.classList.remove('active'));
        
        bonusStarsContainer.style.display = 'none';

        if (isAlreadyActive) {
            delete data[currentWeekData.weekStart];
        } else {
            button.classList.add('active');
            if (status === 'complete') {
                bonusStarsContainer.style.display = 'block';
                return;
            } else {
                data[currentWeekData.weekStart] = { status: status };
            }
        }
        
        saveData();
        overlay.classList.remove('visible');
    });
});

confirmBonusBtn.addEventListener('click', () => {
    if (currentWeekData.weekStart) {
        const selectedBonusStarsCount = document.querySelectorAll('#bonus-stars-picker .fas.fa-star.active').length;
        data[currentWeekData.weekStart] = { status: 'complete', bonusStars: selectedBonusStarsCount };
        saveData();
        overlay.classList.remove('visible');
    }
});

closeOverlayBtn.addEventListener('click', () => {
    overlay.classList.remove('visible');
});

prevMonthBtn.addEventListener('click', () => {
    if (currentDate.getTime() > START_DATE.getTime()) {
        currentDate.setMonth(currentDate.getMonth() - 1);
        renderCalendar();
    }
});

nextMonthBtn.addEventListener('click', () => {
    currentDate.setMonth(currentDate.getMonth() + 1);
    renderCalendar();
});

renderCalendar();
updateStats();