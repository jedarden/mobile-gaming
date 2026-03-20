/**
 * Save the Character - State Management
 *
 * Pure state functions for scenario-based survival game.
 * Players choose actions to save a character from various threats.
 */

/**
 * Create initial game state from scenario data
 *
 * @param {Object} scenarioData - Scenario definition from levels.json
 * @returns {Object} Initial game state
 */
export function createInitialState(scenarioData) {
  return {
    scenario: {
      id: scenarioData.id,
      title: scenarioData.title,
      threat: scenarioData.threat,
      choices: scenarioData.choices.map(c => ({ ...c }))
    },
    selectedChoice: null,
    status: 'choosing'
  };
}

/**
 * Select a choice and transition to animating state
 *
 * @param {Object} state - Current game state
 * @param {string} choiceId - ID of the selected choice
 * @returns {Object} New state with selected choice and animating status
 */
export function selectChoice(state, choiceId) {
  // Find the selected choice
  const choice = state.scenario.choices.find(c => c.id === choiceId);
  if (!choice) {
    return state;
  }

  return {
    ...state,
    selectedChoice: { ...choice },
    status: 'animating'
  };
}

/**
 * Resolve the selected choice and determine win/lose
 *
 * @param {Object} state - Current game state (should have status: "animating")
 * @returns {Object} New state with status "won" or "lost"
 */
export function resolveChoice(state) {
  if (!state.selectedChoice || state.status !== 'animating') {
    return state;
  }

  return {
    ...state,
    status: state.selectedChoice.correct ? 'won' : 'lost'
  };
}

/**
 * Advance to the next scenario
 *
 * @param {Object} state - Current game state
 * @param {Object} newScenarioData - Next scenario definition from levels.json
 * @returns {Object} Fresh state for the new scenario
 */
export function nextScenario(state, newScenarioData) {
  return createInitialState(newScenarioData);
}

/**
 * Get the current scenario title
 *
 * @param {Object} state - Game state
 * @returns {string} Scenario title
 */
export function getScenarioTitle(state) {
  return state.scenario.title;
}

/**
 * Get the current threat description
 *
 * @param {Object} state - Game state
 * @returns {string} Threat description
 */
export function getThreat(state) {
  return state.scenario.threat;
}

/**
 * Get available choices for current scenario
 *
 * @param {Object} state - Game state
 * @returns {Array} Array of choice objects
 */
export function getChoices(state) {
  return state.scenario.choices;
}

/**
 * Check if game is in choosing state
 *
 * @param {Object} state - Game state
 * @returns {boolean} True if status is "choosing"
 */
export function isChoosing(state) {
  return state.status === 'choosing';
}

/**
 * Check if game is in animating state
 *
 * @param {Object} state - Game state
 * @returns {boolean} True if status is "animating"
 */
export function isAnimating(state) {
  return state.status === 'animating';
}

/**
 * Check if player won
 *
 * @param {Object} state - Game state
 * @returns {boolean} True if status is "won"
 */
export function isWon(state) {
  return state.status === 'won';
}

/**
 * Check if player lost
 *
 * @param {Object} state - Game state
 * @returns {boolean} True if status is "lost"
 */
export function isLost(state) {
  return state.status === 'lost';
}

/**
 * Validate a scenario definition
 *
 * @param {Object} scenario - Scenario to validate
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export function validateScenario(scenario) {
  const errors = [];

  // Required fields
  if (!scenario.id) errors.push('Missing scenario id');
  if (!scenario.title) errors.push('Missing scenario title');
  if (!scenario.threat) errors.push('Missing threat description');

  // Validate choices
  if (!scenario.choices || !Array.isArray(scenario.choices)) {
    errors.push('Missing or invalid choices array');
  } else if (scenario.choices.length < 2 || scenario.choices.length > 4) {
    errors.push('Scenario must have 2-4 choices');
  } else {
    const choiceIds = new Set();
    let correctCount = 0;

    scenario.choices.forEach((choice, i) => {
      if (!choice.id) errors.push(`Choice ${i} missing id`);
      if (!choice.label) errors.push(`Choice ${i} missing label`);
      if (typeof choice.correct !== 'boolean') {
        errors.push(`Choice ${i} missing correct boolean`);
      }
      if (choiceIds.has(choice.id)) errors.push(`Duplicate choice id: ${choice.id}`);
      choiceIds.add(choice.id);
      if (choice.correct === true) correctCount++;
    });

    if (correctCount !== 1) {
      errors.push('Scenario must have exactly one correct choice');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export default {
  createInitialState,
  selectChoice,
  resolveChoice,
  nextScenario,
  getScenarioTitle,
  getThreat,
  getChoices,
  isChoosing,
  isAnimating,
  isWon,
  isLost,
  validateScenario
};
