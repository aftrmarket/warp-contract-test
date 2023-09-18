async function handle(state, action) {
    const input = action.input;

    if (input.function === "callJoin") {
        // Expects a key with a teamId to be verified
        const joinResult = await SmartWeave.contracts.write(input.contractId, { function: 'join', key: input.key });
        if (joinResult.type !== "ok") {
            throw new ContractError(`Unable to join ${contractId}`);
        }

        state.participants.push(input.key);

        return { state };
    }
}