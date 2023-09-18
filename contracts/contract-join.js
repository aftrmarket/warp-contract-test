var TEAM_REGISTRY_CONTRACT_ID = "I0sBQYSmxuDreHAgsV2hsE-Zlnh7qVNjJywmP6QFDsg";

async function handle(state, action) {
    const input = action.input;

    if (input.function === "join") {
        const teamRegState = await SmartWeave.contracts.readContractState(TEAM_REGISTRY_CONTRACT_ID);
        if (!teamRegState.register[input.key]) {
            throw new ContractError("Team is unverified.");
        }
        state.participants.push(input.key);
    }

    return { state };
}
