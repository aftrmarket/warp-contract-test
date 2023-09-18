var TEAM_REGISTRY_CONTRACT_ID = "I0sBQYSmxuDreHAgsV2hsE-Zlnh7qVNjJywmP6QFDsg";
var GAME_CURRENCY_CONTRACT_ID = "kXaBP8ecV0djbUkocQWvCc7G2fSF8LJxriZJwJmGI1I";

async function handle(state, action) {
    var _a;
    const balances = state.balances;
    const input = action.input;
    const caller = action.caller;

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
                orgId: item.orgId,
            });
        }
        const teamRegState = await SmartWeave.contracts.readContractState(TEAM_REGISTRY_CONTRACT_ID);
        if (!teamRegState.register[caller]) {
            throw new ContractError("Team is unverified.");
        }
        state.participants.push({
            team: caller,
            starters,
        });
    }
    return { state };
}

