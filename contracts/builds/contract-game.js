// contract/game/contract.ts
var PLATFORM_WALLET = "bAJYgxGXt9KE4g8H7l7u80iFaBIgzpUQNUgycJby0lU";
var TEAM_REGISTRY_CONTRACT_ID = "<TEAM REGISTRY PLACEHOLDER>";
var PLAYER_REGISTRY_CONTRACT_ID = "O9ydSrBgJhY0dz4XFsibi2Tt-bQfunonTBk2KVvFMUA";
var GAME_CURRENCY_CONTRACT_ID = "xYNpGhT1zBPRjD2aW8AJLFBn3EFaew72e9Czs9ZOr6U";
var POOL_COMMISSION = 0.1;
async function handle(state, action) {
  var _a;
  const balances = state.balances;
  const input = action.input;
  const caller = action.caller;
  let errorFlag = false;
  if (input.function === "joinGame") {
    if (state.gameStatus !== "open") {
      throw new ContractError("Game is not accepting participates.");
    }
    if (state.maxParticipants && state.maxParticipants !== 0) {
      const numParticipants = state.participants.length;
      if (numParticipants > state.maxParticipants) {
        throw new ContractError("Participants maximum has been reached.");
      }
    }
    if (state.invites && Array.isArray(state.invites) && state.invites.length > 0) {
      if (!state.invites.includes(caller)) {
        throw new ContractError("Team is not allowed to join this game.");
      }
    }
    if (!input.value || !Array.isArray(input.value)) {
      throw new ContractError("Invalid value.");
    }
    const maxPositions = state.gameParameters.starters;
    let starters = [];
    for (const item of input.value) {
      if (typeof item !== "object" || !item.hasOwnProperty("player") || typeof item.player !== "string" || !item.hasOwnProperty("position") || !["qb", "rb", "wr", "d", "k"].includes(item.position)) {
        throw new ContractError("Invalid lineup.");
      }
      if (maxPositions.hasOwnProperty(item.position) && item.position in maxPositions) {
        const maxCount = maxPositions[item.position];
        const positionCount = input.value.filter((i) => i.position === item.position).length;
        if (positionCount > maxCount) {
          throw new ContractError("Lineup exceeds position limits.");
        }
      }
      if (!state.gameParameters.orgsPermitted.includes(item.orgId)) {
        throw new ContractError(`Invalid lineup - Player ${item.player} is not allowed to participate in this game.`);
      }
      starters.push({
        id: item.player,
        position: item.position,
        orgId: item.orgId
      });
    }
    let entryFeeOk = true;
    if (state.gameType === "entry fee" || state.gameType === "charity") {
      if (!input.txId || typeof input.txId !== "string") {
        throw new ContractError("Can't validate transaction for entry fee.");
      }
      if (!input.qty || typeof input.qty !== "number") {
        throw new ContractError("Invalid quantity for entry fee game.");
      }
      if (input.qty < state.gameParameters.entryFee) {
        throw new ContractError("Did not pay correct entry fee.");
      }
      const claimable = await canClaim(GAME_CURRENCY_CONTRACT_ID, input.qty, input.txId);
      if (claimable) {
        const claimResponse = await SmartWeave.contracts.write(GAME_CURRENCY_CONTRACT_ID, {
          function: "claim",
          txID: input.txId,
          qty: input.qty
        });
        if (claimResponse.type !== "ok") {
          throw new ContractError("Join failed - Unable to claim purchase.");
        }
        (_a = state.deposits) == null ? void 0 : _a.push({
          tokenId: GAME_CURRENCY_CONTRACT_ID,
          txId: input.txId,
          from: caller,
          qty: input.qty
        });
        if (!state.pool) {
          state["pool"] = 0;
        }
        state.pool += input.qty;
      } else {
        entryFeeOk = false;
        state.gameErrorMessages.push(`Entry Fee Error for Team ${caller}. Reject interaction initiated.`);
        const rejectResult = await SmartWeave.contracts.write(GAME_CURRENCY_CONTRACT_ID, {
          function: "reject",
          tx: input.txId
        });
        if (rejectResult.type !== "ok") {
          throw new ContractError("Claim not found AND reject failed on token " + GAME_CURRENCY_CONTRACT_ID);
        }
      }
    }
    if (entryFeeOk) {
    //   const teamRegState = await SmartWeave.contracts.readContractState(TEAM_REGISTRY_CONTRACT_ID);
    //   if (!teamRegState.register[caller]) {
    //     throw new ContractError("Team is unverified.");
    //   }
      state.participants.push({
        team: caller,
        starters
      });
    }
  }
  if (input.function === "openGame") {
    if (caller !== state.owner) {
      throw new ContractError("Invalid caller.");
    }
    if (state.gameStatus === "not started") {
      throw new ContractError("Game can only be opened from a status of 'not started'.");
    }
    const startDate = new Date(state.gameLength.startDate);
    const currentDate = new Date(input.value);
    if (currentDate < startDate) {
      state.gameStatus = "open";
    }
  }
  if (input.function === "updateGameStatus") {
    if (caller !== PLATFORM_WALLET) {
      throw new ContractError("Invalid caller.");
    }
    if (!input.value || !isValidDateFormat(input.value)) {
      throw new ContractError("Invalid date.");
    }
    const currentGameStatus = state.gameStatus;
    if (currentGameStatus === "error") {
      throw new ContractError("The game is currently in an errored state.  Only the game owner can make changes.");
    }
    if (currentGameStatus === "not started") {
      throw new ContractError("Waiting on owner to open game.");
    }
    const startDate = new Date(state.gameLength.startDate);
    const endDate = new Date(state.gameLength.endDate);
    const currentDate = new Date(input.value);
    if (currentDate < startDate) {
      const startGame = areReqsSatisfied(state);
      if (startGame) {
        state.gameStatus = "open";
      } else {
        state.gameStatus = "error";
      }
    } else if (endDate < currentDate) {
      await finalizeGame(state);
      state.gameStatus = "completed";
    } else {
      state.gameStatus = "in progress";
    }
  }
  if (input.function === "deposit") {
    if (!input.txID) {
      throw new ContractError("The transaction is not valid.  Tokens were not transferred to the game.");
    }
    if (!input.tokenId) {
      throw new ContractError("No token supplied. Tokens were not transferred to the game.");
    }
    if (input.tokenId === SmartWeave.contract.id) {
      throw new ContractError("Deposit not allowed because you can't deposit an asset of itself.");
    }
    if (input.tokenId !== GAME_CURRENCY_CONTRACT_ID) {
      throw new ContractError("Only tokens of the Game Currency are allowed to be deposited.");
    }
    if (!input.qty || typeof +input.qty !== "number" || +input.qty <= 0) {
      throw new ContractError("Qty is invalid.");
    }
    const claimable = await canClaim(input.tokenId, input.qty, input.txID);
    if (claimable) {
      const transferResult = await SmartWeave.contracts.write(input.tokenId, {
        function: "claim",
        txID: input.txID,
        qty: input.qty
      });
      if (transferResult.type !== "ok") {
        throw new ContractError("Unable to deposit token " + input.tokenId);
      }
      if (!state.pool) {
        state["pool"] = 0;
      }
      state.pool += input.qty;
    } else {
      state.gameErrorMessages.push(`Deposit Error for ${caller}. Reject interaction initiated.`);
    //   const rejectResult = await SmartWeave.contracts.write(input.tokenId, {
    //     function: "reject",
    //     tx: input.txID
    //   });
    //   if (rejectResult.type !== "ok") {
    //     throw new ContractError("Claim not found AND reject failed on token " + input.tokenId);
    //   }
    }
  }
  if (input.function === "platformAdjust") {
    if (caller !== PLATFORM_WALLET) {
      throw new ContractError("Invalid caller.");
    }
    if (input.key && input.value) {
      state[input.key] = input.value;
    }
  }
  if (input.function === "depositPool") {
    if (caller !== PLATFORM_WALLET) {
      throw new ContractError("Invalid caller.");
    }
    if (!input.key || typeof input.key !== "string") {
      throw new ContractError("Key is invalid.");
    }
    if (!input.qty || typeof +input.qty !== "number" || +input.qty <= 0) {
      throw new ContractError("Qty is invalid.");
    }
    await depositPoolFunds(state, input.key, input.qty);
  }
  if (input.function === "refundPool") {
    if (caller !== PLATFORM_WALLET) {
      throw new ContractError("Invalid caller.");
    }
    if (state.pool && state.pool <= 0) {
      throw new ContractError("No pool to refund.");
    }
    await refundPool(state);
    state.gameErrorMessages.push("Pool refund triggered by platform admin.");
    state.gameStatusMessage = "Pool was refunded.";
  }
  return { state };
}
async function depositPoolFunds(state, teamId, qty) {
  let input = {
    function: "allow",
    target: teamId,
    qty
  };
  let txId = await SmartWeave.contracts.write(GAME_CURRENCY_CONTRACT_ID, input);
  if (txId.type !== "ok") {
    state.gameErrorMessages.push(`Depositing pool funds to Team ${teamId} failed during Allow process.`);
  }
  input = {
    function: "deposit",
    //@ts-ignore
    tokenId: GAME_CURRENCY_CONTRACT_ID,
    qty,
    txID: txId
  };
  txId = await SmartWeave.contracts.write(teamId, input);
  if (txId.type !== "ok") {
    state.gameErrorMessages.push(`Depositing pool funds to Team ${teamId} failed during Deposit process.`);
  }
  if (state.pool) {
    state.pool -= qty;
  }
}
function areReqsSatisfied(state) {
  if (state.gameType === "entry fee" || state.gameType === "sponsored") {
    const min = state.minParticipants === 0 ? -1 : state.minParticipants;
    if (state.participants.length < min) {
      state.gameStatusMessage = "Minimum participants not met.";
      return false;
    }
    if (state.gameType === "sponsored" && (!state.pool || state.pool <= 0)) {
      state.gameStatusMessage = "Pool has not been funded.";
      return false;
    }
  }
  return true;
}
function createHistory(state, playerScores) {
  for (const team of state.participants) {
    let teamScore = 0;
    const scores = {};
    for (const player of team.starters) {
      const score = playerScores[player.id] || 0;
      teamScore += score;
      scores[player.id] = score;
    }
    const teamScores = {
      team: team.team,
      teamScore,
      scores
    };
    state.history.push(teamScores);
  }
}
function isValidDateFormat(value) {
  const regex = /^(0[1-9]|1[0-2])\/(0[1-9]|1\d|2\d|3[01])\/\d{4}$/;
  return regex.test(value);
}
function calculatePoints(rank, totalUsers) {
  const basePointsMax = 100;
  const basePointsMin = 10;
  const newBase = Math.max(basePointsMax - (basePointsMax - basePointsMin) / (totalUsers - 1) * (rank - 1));
  const performanceMultiplier = totalUsers / rank;
  const normalizationFactor = totalUsers / Math.sqrt(totalUsers);
  const pointsEarned = newBase * performanceMultiplier / normalizationFactor;
  const reward = Math.round(pointsEarned);
  if (reward == 0) {
    return 1;
  }
  return reward;
}
async function refundPool(state) {
  for (const team in state.deposits) {
    let input = {
      function: "allow",
      //@ts-expect-error
      target: team.from,
      // target: team.fundedBy,
      // @ts-expect-error
      qty: team.qty
    };
    let txId = await SmartWeave.contracts.write(GAME_CURRENCY_CONTRACT_ID, input);
    if (txId.type !== "ok") {
      state.gameErrorMessages.push(`Refund back to Team ${team.from} failed during Allow process.`);
    }
    input = {
      function: "deposit",
      //@ts-ignore
      tokenId: GAME_CURRENCY_CONTRACT_ID,
      //@ts-expect-error
      qty: team.qty,
      txID: txId
    };
    txId = await SmartWeave.contracts.write(team.from, input);
    if (txId !== "ok") {
      state.gameErrorMessages.push(`Refund back to Team ${team.from} failed during Deposit process.`);
    }
  }
}
function assignTiers(participants, winners) {
  const tiers = [];
  let tierSize = 0;
  let currentTier = 1;
  let currentTierSize = 0;
  let numWinners = 0;
  ;
  const numTiers = Object.keys(winners.tierRewards).length;
  ;
  let i = 0;
  if (winners.type === "%") {
    tierSize = Math.round(winners.threshold * participants.length);
  }
  while (currentTier <= numTiers) {
    const participant = participants[i];
    participant.tier = currentTier;
    tiers[currentTier - 1] = tiers[currentTier - 1] || [];
    tiers[currentTier - 1].push(participant);
    numWinners++;
    i++;
    if (winners.type === "x") {
      if (participants[i].teamScore < participant.teamScore) {
        currentTier++;
        if (numWinners >= numTiers) {
          currentTier = numTiers + 1;
        }
      }
    } else {
      currentTierSize++;
      if (currentTierSize >= tierSize) {
        currentTier++;
        currentTierSize = 0;
      }
    }
  }
  return tiers;
}
function distributeRewards(state) {
  var _a;
  const rankedTeams = [...state.history].sort((a, b) => b.teamScore - a.teamScore);
  const totalTeams = rankedTeams.length;
  let rank = 1;
  for (let i = 0; i < totalTeams; i++) {
    const team = rankedTeams[i];
    const nextTeam = rankedTeams[i + 1];
    team.rank = rank;
    if (nextTeam && team.teamScore !== nextTeam.teamScore) {
      rank++;
    }
  }
  for (let team of rankedTeams) {
    if (totalTeams === 1) {
      state.balances[team.team] = 1;
    } else {
      const reward = calculatePoints(team.rank, totalTeams);
      state.balances[team.team] = reward;
    }
  }
  if (typeof state.pool !== "undefined" && state.pool > 0) {
    const tiers = assignTiers(rankedTeams, state.gameParameters.winners);
    const participantsCount = tiers.map((tier) => tier.length);
    const tierRewardsTotal = {};
    const tierRewards = (_a = state.gameParameters.winners) == null ? void 0 : _a.tierRewards;
    const tierKeys = Object.keys(tierRewards);
    const reservedPool = state.pool * (1 - POOL_COMMISSION);
    for (let i = 0; i < tierKeys.length; i++) {
      const tier = tierKeys[i];
      const rewardPercentage = tierRewards[tier];
      const participants = participantsCount[tier - 1];
      const tierReward = reservedPool * rewardPercentage;
      tierRewardsTotal[tier] = tierReward;
    }
    for (const winners of tiers) {
      for (const winner of winners) {
        const pos = winner.tier - 1;
        const rewardAmount = tierRewardsTotal[winner.tier] / participantsCount[pos];
        state.teamPoolRewards[winner.team] = rewardAmount;
      }
    }
  }
}
async function finalizeGame(state) {
  if (state.gameStatus !== "in progress") {
    throw new ContractError("Game is not in progress.");
  }
  const gamePlayers = [...new Set(state.participants.flatMap((team) => team.starters.map((player) => player.id)))];
  let weeks = [];
  for (let i = state.gameLength.start; i <= state.gameLength.end; i++) {
    weeks.push(i);
  }
  const response = await SmartWeave.contracts.viewContractState(PLAYER_REGISTRY_CONTRACT_ID, {
    function: "getScores",
    players: gamePlayers,
    weeks
  });
  if (response.type !== "ok") {
  }
  createHistory(state, response.result.playerScores);
  distributeRewards(state);
}
async function canClaim(claimTokenId, qty, txId) {
  const tokenState = await SmartWeave.contracts.readContractState(claimTokenId);
  const claimable = tokenState.claimable.filter((c) => c.txID === txId && c.to === SmartWeave.contract.id && c.qty === qty);
  if (claimable.length > 0) {
    return true;
  }
  return false;
}
