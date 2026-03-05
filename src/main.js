// Mobile Gaming - Main entry point

document.addEventListener('DOMContentLoaded', () => {
  console.log('Mobile Gaming loaded');

  // Future: Add game routing and initialization
  const gameCards = document.querySelectorAll('.game-card:not(.coming-soon)');

  gameCards.forEach(card => {
    card.addEventListener('click', () => {
      const gameName = card.querySelector('h2').textContent;
      console.log(`Starting game: ${gameName}`);
      // TODO: Route to game
    });
  });
});
