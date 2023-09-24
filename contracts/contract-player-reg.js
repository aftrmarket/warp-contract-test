// registry-player
var PLATFORM_WALLET = "bAJYgxGXt9KE4g8H7l7u80iFaBIgzpUQNUgycJby0lU";
async function handle(state, action) {
  const input = action.input;
  const caller = action.caller;
  if (caller !== PLATFORM_WALLET && input.function !== "getScores" && input.function !== "verify" && input.function !== "updatePlayerPrice") {
    throw new ContractError("Invalid caller.");
  }
  if (input.function === "register") {
    if (!checkDuplicate(state.register, input.value)) {
      state.register.push(input.value);
    }
  }
  if (input.function === "updateRegistry") {
    if (!input.key || typeof input.key !== "string") {
      throw new ContractError("Invalid Player ID");
    }
    if (!input.value || typeof input.value !== "object") {
      throw new ContractError("Invalid score object.");
    }
    let player = state.register.find((p) => p.id === input.key);
    if (player) {
      Object.assign(player, input.value);
    }
  }
  if (input.function === "sendScores") {
    if (!input.key || typeof input.key !== "string") {
      throw new ContractError("Invalid Player ID");
    }
    if (!input.value || typeof input.value !== "object") {
      throw new ContractError("Invalid score object.");
    }
    const { week, points } = input.value;
    if (typeof week !== "number" || typeof points !== "number") {
      throw new ContractError("Invalid score object week or points.");
    }
    const player = state.register.find((p) => p.id === input.key);
    if (player) {
      const score = player.scores.length > 0 ? player.scores.find((score2) => score2.week === input.value.week) : void 0;
      if (score) {
        score.points = input.value.points;
      } else {
        player.scores.push(input.value);
      }
    }
  }
  if (input.function === "sendScoresBatch") {
    if (!validateInput(input)) {
      throw new ContractError("Input is invalid.");
    }
    for (const playerScore of input.value) {
      const player = state.register.find((p) => p.id === playerScore.key);
      if (player) {
        const score = player.scores.length > 0 ? player.scores.find((score2) => score2.week === playerScore.value.week) : void 0;
        if (score) {
          score.points = playerScore.value.points;
        } else {
          player.scores.push(playerScore.value);
        }
      }
    }
  }
  if (input.function === "getScores") {
    if (!input.players || !Array.isArray(input.players) || input.players.length === 0) {
      throw new ContractError("Invalid players[].");
    }
    if (!input.weeks || !Array.isArray(input.weeks) || input.weeks.length === 0) {
      throw new ContractError("Invalid weeks[].");
    }
    const playerScores = {};
    for (const player of input.players) {
      const registeredPlayer = state.register.find((p) => p.id === player);
      let totalPoints = 0;
      if (registeredPlayer) {
        for (const score of registeredPlayer.scores) {
          if (input.weeks.includes(score.week)) {
            totalPoints += score.points;
          }
        }
      }
      playerScores[player] = totalPoints;
    }
    return { result: { playerScores } };
  }
  if (input.function === "updatePlayerPrice") {
    if (typeof input.value === "undefined" || isNaN(input.value) || input.value === "") {
      throw new ContractError("Invalid price.");
    }
    if (typeof input.key === "undefined" || typeof input.key !== "string" || input.value === "") {
      throw new ContractError("Invalid key.");
    }
    if (caller !== PLATFORM_WALLET && caller !== input.key) {
      throw new ContractError("Invalid caller.");
    }
    const player = state.register.find((player2) => player2.id === input.key);
    if (player && caller === input.key) {
      player.price = input.value;
    } else if (player && player.price !== input.value) {
      const playerState = await SmartWeave.contracts.readContractState(input.key);
      const playerPrice = playerState.price;
      player.price = playerPrice;
    }
  }
  if (input.function === "playerOwnsRepo") {
    if (!input.key || typeof input.key !== "string") {
      throw new ContractError("Invalid key");
    }
    const player = state.register.find((player2) => player2.id === input.key);
    if (player) {
      player.meta.verified = true;
    }
  }
  if (input.function === "verify") {
    if (!input.key || typeof input.key !== "string") {
      throw new ContractError("Invalid key");
    }
    const result = state.register.find((player) => player.id === input.key);
    return { result };
  }
  return { state };
}
function checkDuplicate(register, newEntry) {
  const registerIds = new Set(register.map((entry) => entry.id));
  return registerIds.has(newEntry.id);
}
function validateInput(input) {
  if (!Array.isArray(input.value)) {
    return false;
  }
  for (const item of input.value) {
    if (typeof item.key !== "string" || typeof item.value.week !== "number" || typeof item.value.points !== "number") {
      return false;
    }
  }
  return true;
}
