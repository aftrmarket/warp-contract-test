const teamTemplate = {
    name: "",
    ticker: "",
    balances: {},
    tokens: [],
    votes: [],
    status: "started",
    owner: "",
    ownership: "single",
    votingSystem: "weighted",
    claims: [],
    claimable: [],
    settings: [
        ["quorum", 0.5],
        ["support", 0.51],
        ["voteLength", 2160],
        ["communityLogo", ""]
    ],
    protected: ["teamSetup", "teamLimits", "games"],
    teamSetup: {
        starters: [],
        bench: []
    },
    teamLimits: [
        { position: "qb", starterLimit: 1, benchLimit: 1 },
        { position: "rb", starterLimit: 2, benchLimit: 2 },
        { position: "wr", starterLimit: 3, benchLimit: 2 },
        { position: "k", starterLimit: 1, benchLimit: 1 },
        { position: "d", starterLimit: 1, benchLimit: 1 }
      ]
};