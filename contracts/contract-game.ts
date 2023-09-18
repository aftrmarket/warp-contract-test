// Game Contract

import { StateInterface, ActionInterface, InputInterface, PlayerInterface, ScoresInterface, WinnersInterface, DepositInterface } from "./faces";

const PLATFORM_WALLET = "<PLATFORM WALLET PLACEHOLDER>";
export { PLATFORM_WALLET };

let TEAM_REGISTRY_CONTRACT_ID = "<TEAM REGISTRY CONTRACT ID PLACEHOLDER>";
export { TEAM_REGISTRY_CONTRACT_ID };

let PLAYER_REGISTRY_CONTRACT_ID = "<PLAYER REGISTRY CONTRACT ID PLACEHOLDER>";
export { PLAYER_REGISTRY_CONTRACT_ID };

const GAME_CURRENCY_CONTRACT_ID = "<GAME CURRENCY CONTRACT ID PLACEHOLDER>";
export { GAME_CURRENCY_CONTRACT_ID };

const POOL_COMMISSION = 0.1;     // Percentage of the pool that the platform and community split
export { POOL_COMMISSION };

declare const ContractError: any;
declare const SmartWeave: any;

export async function handle(state: StateInterface, action: ActionInterface) {
    const balances = state.balances;
	const input = action.input;
    const caller = action.caller;
    let errorFlag = false;
        
    if (input.function === "joinGame") {
        /*** 
         * INPUTS:
         *      function: 'joinGame'
         *      value: PlayerInterface[],
         *      txId: string (txID of allow on the gameCurrency contract -> for entry fee games)
         *      qty: number (entry fee amount paid)
         * 
         * DESC:
         * 1. Ensures gameStatus is open
         * 2. Ensures participates limits aren't hit
         * 3. Checks invites list if invites is set
         * 4. Validates team hasn't violated starter limits
         * 5. Ensures team has paid fee (if applicable)
         * 6. Checks the Registry contract to ensure Team is in the registry in good standing
         * 7. Adds teamId (caller) to participants[]
         * 
         * 
         * TODO: 
         *  1. Decide on architecture for bullet 5
         *  2. Set Registry Contract ID
         *  */


        // 1
        if (state.gameStatus !== "open") {
            throw new ContractError("Game is not accepting participates.");
        }

        // 2
        if (state.maxParticipants && state.maxParticipants !== 0) {
            const numParticipants = state.participants.length;
            if (numParticipants > state.maxParticipants) {
                throw new ContractError("Participants maximum has been reached.");
            }
        }

        // 3
        if (state.invites && Array.isArray(state.invites) && state.invites.length > 0) {
            if (!state.invites.includes(caller)) {
                throw new ContractError("Team is not allowed to join this game.");
            }
        }

        // 4
        if (!input.value || !Array.isArray(input.value)) {
            throw new ContractError("Invalid value.");
        }
        const maxPositions = state.gameParameters.starters;

        let starters: PlayerInterface[] = [];

        for (const item of input.value) {
            if (typeof item !== 'object' || !item.hasOwnProperty('player') || typeof item.player !== 'string' || !item.hasOwnProperty('position') || !['qb', 'rb', 'wr', 'd', 'k'].includes(item.position)) {
                throw new ContractError("Invalid lineup.");
            }
      
            // Check if the position count exceeds the maximum allowed
            if (maxPositions.hasOwnProperty(item.position) && item.position in maxPositions) {
                const maxCount = maxPositions[item.position];
                const positionCount = input.value.filter(i => i.position === item.position).length;
      
                if (positionCount > maxCount) {
                    throw new ContractError("Lineup exceeds position limits.");
                }
            }

            // Are there any players from orgs not in game?
            if (!state.gameParameters.orgsPermitted.includes(item.orgId)) {
                throw new ContractError(`Invalid lineup - Player ${item.player} is not allowed to participate in this game.`);
            }

            starters.push({
                id: item.player,
                position: item.position,
                orgId: item.orgId
            });
        }

        // 5
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

            // Test to see if claim is there
            const claimable = await canClaim(GAME_CURRENCY_CONTRACT_ID, input.qty, input.txId);
            if (claimable) {
                // Claim entry fee
                const claimResponse = await SmartWeave.contracts.write(GAME_CURRENCY_CONTRACT_ID, {
                    function: "claim",
                    txID: input.txId,
                    qty: input.qty
                });
        
                if (claimResponse.type !== "ok") {
                    throw new ContractError("Join failed - Unable to claim purchase.");
                }

                state.deposits?.push({
                    tokenId: GAME_CURRENCY_CONTRACT_ID,
                    txId: input.txId,
                    from: caller,
                    qty: input.qty
                });
                
                // Update the pool
                if (!state.pool) {
                    state["pool"] = 0;
                }
                state.pool += input.qty;
            } else {
                // Call reject function
                entryFeeOk = false;     // Can't throw contract error because reject won't go through if you do
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
            // 6
             /***** REMOVING viewContractState call
            const verifyResult = await SmartWeave.contracts.viewContractState(TEAM_REGISTRY_CONTRACT_ID, {
                function: "verify",
                key: caller
            });

            // Result returns true if Team is verified
            if (verifyResult.type !== "ok" || !verifyResult.result) {
                throw new ContractError("Team is unverified.");
            }
            ****************************/
            
            /***** NEW CODE */
            const teamRegState = await SmartWeave.contracts.readContractState(TEAM_REGISTRY_CONTRACT_ID);
            if (!teamRegState.register[caller]) {
                throw new ContractError("Team is unverified.");
            }
            /************** */

            // 7
            state.participants.push({ 
                team: caller,
                starters
            });
        }
    }

    if (input.function === "openGame") {
        /*** 
         * This interation opens the game to accept participants.  It can only be called by the game owner.
         * INPUT:
         * value: string   // Represents current date.  Format "mm/dd/yyyy"
         */

        if (caller !== state.owner) {
            throw new ContractError("Invalid caller.");
        }

        if (state.gameStatus === "not started") {
            throw new ContractError("Game can only be opened from a status of 'not started'.");
        }

        // Get dates
        const startDate = new Date(state.gameLength.startDate);
        const currentDate = new Date(input.value);

        if (currentDate < startDate) {
            state.gameStatus = "open";
        }
    }

    if (input.function === "updateGameStatus") {
         /*** 
         * This interaction determines the game status based on the current time.
         * INPUT:
         * value: string   // Represents current date.  Format "mm/dd/yyyy"
         */
        
        if (caller !== PLATFORM_WALLET) {
            throw new ContractError("Invalid caller.");
        }

        if (!input.value || !isValidDateFormat(input.value) ) {
            throw new ContractError("Invalid date.");
        }

        const currentGameStatus = state.gameStatus;
        if (currentGameStatus === "error") {
            throw new ContractError("The game is currently in an errored state.  Only the game owner can make changes.");
        }

        if (currentGameStatus === "not started") {
            throw new ContractError("Waiting on owner to open game.");
        }

        // Get dates
        const startDate = new Date(state.gameLength.startDate);
        const endDate = new Date(state.gameLength.endDate);
        const currentDate = new Date(input.value);
        
        if (currentDate < startDate) {
            // Game should be opened, but does the game meet the requirements to start?
            const startGame = areReqsSatisfied(state);

            if (startGame) {
                state.gameStatus = "open";
            } else {
                state.gameStatus = "error";
                //await refundPool(state);
            }
        } else if (endDate < currentDate) {
            await finalizeGame(state);
            state.gameStatus = "completed"
        } else {
            state.gameStatus = "in progress"
        }
    }

    if (input.function === "deposit") {
        /*** 
         * Called by Sponsor of game to fund the pool.
         * Input is a DepositInterface
         * Call claim function on input.tokenId 
         * Needs to keep track where deposit came from
         * Update state.pool
         */

        // TODO:

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

        // Test to see if claim is there
        const claimable = await canClaim(input.tokenId, input.qty, input.txID);
        if (claimable) {
            // Call the claim function on the depositing contract
            const transferResult = await SmartWeave.contracts.write(input.tokenId, {
                function: "claim",
                txID: input.txID,
                qty: input.qty,
            });

            if (transferResult.type !== "ok") {
                throw new ContractError("Unable to deposit token " + input.tokenId);
            }

            // Update the pool
            if (!state.pool) {
                state["pool"] = 0;
            }
            state.pool += input.qty;
        } else {
            // Call reject function to send tokens back
            state.gameErrorMessages.push(`Deposit Error for ${caller}. Reject interaction initiated.`);
            const rejectResult = await SmartWeave.contracts.write(input.tokenId, {
                function: "reject",
                tx: input.txID
            });
            if (rejectResult.type !== "ok") {
                throw new ContractError("Claim not found AND reject failed on token " + input.tokenId);
            }   
        }
    }

    if (input.function === "platformAdjust") {
        /****
         * This interaction is used to fix any errors logged that may have occurred in the game.
         * It can only be called by the PLATFORM WALLET.
         * Examples include:
         * 1. Fixing failed refunds.
         */
        
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

async function depositPoolFunds(state: StateInterface, teamId: string, qty: number) {
        // Call allow on Game Currency
        let input = {
            function: "allow",
            target: teamId,
            qty
        };
        let txId = await SmartWeave.contracts.write(GAME_CURRENCY_CONTRACT_ID, input);

        if (txId.type !== "ok") {
            state.gameErrorMessages.push(`Depositing pool funds to Team ${teamId} failed during Allow process.`);
        }

        // Call deposit on Team
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


function areReqsSatisfied(state: StateInterface) {
    // This function validates whether a game can start or not

    if (state.gameType === "entry fee" || state.gameType === "sponsored") {
        // Need to check minimum participants
        const min = state.minParticipants === 0 ? -1 : state.minParticipants;
        if (state.participants.length < min) {
            state.gameStatusMessage = "Minimum participants not met.";
            return false;
        }
        if (state.gameType === "sponsored" && (!state.pool || state.pool <= 0)) {
            // Pool isn't funded
            state.gameStatusMessage = "Pool has not been funded.";
            return false;
        }
    }

    return true;
}

function createHistory(state: StateInterface, playerScores: { [playerId: string]: number }) {
    // Map player scores to ScoresInterface
    for (const team of state.participants) {
        let teamScore = 0;
        const scores = {};
    
        for (const player of team.starters) {
            const score = playerScores[player.id] || 0;
            
            teamScore += score;
            scores[player.id] = score;
        }
    
        const teamScores: ScoresInterface = {
            team: team.team,
            teamScore,
            scores
        };
    
        state.history.push(teamScores);
    }
}

function isValidDateFormat(value: string) {
    const regex = /^(0[1-9]|1[0-2])\/(0[1-9]|1\d|2\d|3[01])\/\d{4}$/;
    return regex.test(value);
}

function calculatePoints(rank: number, totalUsers: number) {
    const basePointsMax = 100;
    const basePointsMin = 10;
    //const newBase = ((totalPlayers - userPosition +1) / totalPlayers) * basePoints;
    const newBase = Math.max(basePointsMax - ((basePointsMax - basePointsMin) / (totalUsers - 1)) * (rank - 1));
    const performanceMultiplier = totalUsers / rank;
    const normalizationFactor = totalUsers / Math.sqrt(totalUsers);
    const pointsEarned = (newBase * performanceMultiplier) / normalizationFactor;
  
    const reward = Math.round(pointsEarned);
    
    if (reward == 0) {
      return 1;
    }
    return reward;
}

async function refundPool(state: StateInterface) {
    // Transfer funds in state.deposits to all teams

    // Use transfer function
    // for (const team in state.deposits) {
    //     const result = await SmartWeave.contracts.write(GAME_CURRENCY_CONTRACT_ID, {
    //         function: "transfer",
    //         //@ts-expect-error
    //         target: team.fundedBy,
    //         //@ts-expect-error
    //         qty: team.qty
    //     });

    //     if (result.type !== "ok") {
    //         //@ts-expect-error
    //         state.gameErrorMessages.push(`Refund back to Wallet ${team.fundedBy} and Team ${team.from} failed.`);
    //     }
    // }

    // Use FCP
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
            //@ts-expect-error
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
        // Send back to team
        //@ts-ignore
        txId = await SmartWeave.contracts.write(team.from, input);

        if (txId !== "ok") {
            //@ts-expect-error
            state.gameErrorMessages.push(`Refund back to Team ${team.from} failed during Deposit process.`);
        }
    }
}

function assignTiers(participants: ScoresInterface[], winners: WinnersInterface) {
    const tiers = [];
    let tierSize = 0;
    let currentTier = 1;
    let currentTierSize = 0;
    let numWinners = 0;
    /* const numTiers = Math.max(...Object.keys(winners.tierRewards)) */;
    const numTiers = Object.keys(winners.tierRewards).length;;
    let i = 0;
    if (winners.type === "%") {
        // @ts-expect-error
        tierSize = Math.round(winners.threshold * participants.length);
    }
    while (currentTier <= numTiers) {
        const participant = participants[i];
        //@ts-expect-error
        participant.tier = currentTier;

        tiers[currentTier-1] = tiers[currentTier-1] || [];
        //@ts-expect-error
        tiers[currentTier-1].push(participant);
        numWinners++;
        i++;
        
        if (winners.type === "x") {
            // Look at the next participant to see if there's a tie before incrementing to next tier
            if (participants[i].teamScore < participant.teamScore) {
                currentTier++;
                if (numWinners >= numTiers) {
                    // Ties have occurred and exceeded allotted winners, allow no more winners
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

function distributeRewards(state: StateInterface) {
    // Rank participants
    const rankedTeams = [...state.history].sort((a, b) => b.teamScore - a.teamScore);
    const totalTeams = rankedTeams.length;

    // Set rank for each team
    let rank = 1

    for (let i = 0; i < totalTeams; i++) {
        const team = rankedTeams[i];
        const nextTeam = rankedTeams[i + 1];
        
        team.rank = rank;
        
        if (nextTeam && team.teamScore !== nextTeam.teamScore) {
            rank++;
        }
    }

    // Get points for each team
    for (let team of rankedTeams) {
        if (totalTeams === 1) {
            // Only grant 1 point if there's 1 team
            // Don't want to inventize single team tournaments
            state.balances[team.team] = 1;
        } else {
            //@ts-expect-error
            const reward = calculatePoints(team.rank, totalTeams);
            state.balances[team.team] = reward;
        }
    }

    if (typeof state.pool !== "undefined" && state.pool > 0) {
        // Assign tiers to teams
        //@ts-expect-error
        const tiers = assignTiers(rankedTeams, state.gameParameters.winners);
        
        // Distributed pool to tiers
        //@ts-expect-error
        const participantsCount = tiers.map((tier) => tier.length);
        const tierRewardsTotal = {};
        const tierRewards = state.gameParameters.winners?.tierRewards;
        //@ts-expect-error
        const tierKeys = Object.keys(tierRewards);

        const reservedPool = state.pool * (1 - POOL_COMMISSION);
        for (let i = 0; i < tierKeys.length; i++) {
            const tier = tierKeys[i];
            //@ts-expect-error
            const rewardPercentage = tierRewards[tier];
            //@ts-expect-error
            const participants = participantsCount[tier - 1];
            const tierReward = reservedPool * rewardPercentage;
            tierRewardsTotal[tier] = tierReward;
        }
        for (const winners of tiers) {
            //@ts-expect-error
            for (const winner of winners) {
                const pos = winner.tier - 1;
                const rewardAmount = tierRewardsTotal[winner.tier] / participantsCount[pos];                 
                //let txId = await depositPoolFunds(state, winner.team, rewardAmount);
                state.teamPoolRewards[winner.team] = rewardAmount;
            }
        }
    }
}

async function finalizeGame(state: StateInterface) {
    /***
     * Ranks teams based off of points.
     * Calls the endGame interaction on each team.
     * Changes gameStatus.
    */

    // Tally results
    // Call the Player Registry to get stats from all players in this game
    // Input: Array of Player IDs
    // Return value:  Object containing Player ID and Score (Key/value pair)
    

    // Is game running?
    if (state.gameStatus !== "in progress") {
        throw new ContractError("Game is not in progress.");
    }

    const gamePlayers = [...new Set(state.participants.flatMap(team => team.starters.map(player => player.id)))];

    // Build weeks array
    let weeks: number[] = [];
    for (let i = state.gameLength.start; i <= state.gameLength.end; i++) {
        weeks.push(i);
    }

    const response = await SmartWeave.contracts.viewContractState(PLAYER_REGISTRY_CONTRACT_ID, {
        function: "getScores",
        players: gamePlayers,
        weeks
    });
    if (response.type !== "ok") {
        // TODO: What happens if this fails?  Game error?
    }

    // Map playerScores to tally team scores, then save in state.history
    createHistory(state, response.result.playerScores);

    // Update balances according to gameParameters.winners
    distributeRewards(state);
}

async function canClaim(claimTokenId: string, qty: number, txId: string): Promise<boolean> {
    const tokenState = await SmartWeave.contracts.readContractState(claimTokenId);
    const claimable = tokenState.claimable.filter((c) => c.txID === txId && c.to === SmartWeave.contract.id && c.qty === qty );
    if (claimable.length > 0) {
        return true;
    }
    return false;
}