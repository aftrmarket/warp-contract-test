const gameTemplate = {
    name: "",
    ticker: "",
    balances: {},
    owner: "",
    gameStatus: "not started",
    participants: [],
    invites: [],
    maxParticipants: 0,
    minParticipants: 0,
    gameLength: {
        start: "",
        end: ""
    },
    gameType: "free",
    gameParameters: {
        winners: {},
        entryFee: 0,
        starters: {
            qb: 1,
            rb: 2,
            wr: 3,
            d: 1,
            k: 1
        }
    },
    history: []
};