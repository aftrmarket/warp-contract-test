var PLAYER_REGISTRY_CONTRACT_ID = "1DktyGHrIaq7Uu_ZkMUQfC02ujICQ_YqBZerf0wrF0U";

async function handle (state, action) {
    const balances = state.balances;
    const input = action.input;
    const caller = action.caller;
  
    if (input.function === 'verify') {
        if (!input.contractId || typeof input.contractId !== 'string') {
            throw new ContractError('Invalid contractId supplied.');
        }

        const verifyResult = await SmartWeave.contracts.viewContractState(PLAYER_REGISTRY_CONTRACT_ID, {
            function: "verify",
            key: input.contractId,
        });
    
        // Return a player if player contract is verified
        if (verifyResult.type !== "ok" || !verifyResult.result) {
            throw new ContractError("Player contract is unverified.");
        }

        // If player verified, add to state
        state.verified.push(input.contractId);

        return { state };
    }
  }