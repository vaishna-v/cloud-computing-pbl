// script.js
document.addEventListener('DOMContentLoaded', function() {
    // Game card click handlers for disabled cards
    const disabledCards = document.querySelectorAll('.game-card.disabled');
    disabledCards.forEach(card => {
        card.addEventListener('click', function(e) {
            e.preventDefault();
            // Optional: Add a subtle effect to show it's disabled
            card.style.opacity = '0.7';
            setTimeout(() => {
                card.style.opacity = '0.5';
            }, 200);
        });
    });

    // Add smooth loading animation for cards
    const cards = document.querySelectorAll('.game-card');
    cards.forEach((card, index) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        
        setTimeout(() => {
            card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, index * 100);
    });
});