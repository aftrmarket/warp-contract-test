# warp-contract-test

## Buy Player Transaction

### Contracts In Test
Currency, Player, and Team

### Sequence of Interactions

1. User buys Player
- An Allow interaction is sent to Currency contract.
- A Deposit interaction is sent to Player contract (this is the claim).  The interaction 'claims' the currency from the Currency contract.  The Currency token is added to state.tokens[].

2. Player is added to User's Team
- An Allow interaction is sent to the Player contract.
- A Deposit interaction is sent to the Team contract.  The interaction 'claims' the Player from the Player contract.  The Player token is added to state.tokens[].


### Test Results
Purchase the same player for 2 teams.

1. Player is purchased for Team 1 successfully.
2. For Team 2, the Player is partially purchased as the 'canClaim' function is returning a false value.  I removed the 'reject' internal write for the test so we can just focus on why the function is failing.

The test prints out the states for Team 1, Team 2, the Player.  If you look at the Player state, you can see that the claimable is there inside of state.claimable[] waiting for Team 2 to claim it.  The claim for Team 1 was processed successfully as proof in the state.claims[] object.

### Running the Test
```javascript
npx arlocal     // Run a separate instance of ArLocal in case you want to read contracts later.

npx jest        // Runs purchase.test.js in __tests__ folder

/*
    Note that you can the following settings in purchase.test.js
    1. env: "DEV" | "TEST" | "PROD" - Runs in various environments
    2. cache: true | false - Change contract cache settings for testnet and mainnet
    3. withoutRejects: true | false - Turns off reject internal write if true
 */
```

### Output
1. Contract IDs
    - Game Currency Contract ID - Currency used to purchase assets
    - Player Registry Contract ID - Registry used for player validation and other data
    - Player Contract Source ID - Player contract source used to create all the players
    - Team Contract Source ID - Team contract source used to create all the teams
2. Player Contract ID - Player purchased in the tests
3. Team 1 Contract ID - Contract ID of Team 1
4. Team 2 Contract ID - Contract ID of Team 2
5. Team 1 Contract State - Results from read contract of Team 1 at the end of the interaction
6. Team 2 Contract State - Results from read contract of Team 2 at the end of the interactions
7. Player Contract State - Results from read contract of Player at the end of the both purchases

### Issue Validation
To easily see the issue, I added 2 objects to the state of the team contracts.  If an issue occurs, these objects will show in the states.  The 2nd purchase of the Player by Team 2 is failing because Team 2 can't find the claim on the Player contract.  If a failure occurs, the team contract will add 2 objects to its state:
1. state.reject = true
2. state.test = claim that it's looking for on the player contract.

If you look at the state of Team 2, you'll see that state.test shows the claim that is sitting in the state.claimables[] object of the Player.

```javascript
// Team 2 state.test
"test": {
    "txID": "RCww_1hsxh17R1Z6QjmVcmdDebPKR1QEY_pNwBxt5vg",
    "to": "T8Ih7fqSm-0y3YG4S6v2A9M3OSajX8EQSg_ZgaCk6yw",
    "qty": 1
}

// Player state.claimable
"claimable": [
    {
        "from": "bAJYgxGXt9KE4g8H7l7u80iFaBIgzpUQNUgycJby0lU",
        "to": "T8Ih7fqSm-0y3YG4S6v2A9M3OSajX8EQSg_ZgaCk6yw",
        "qty": 1,
        "txID": "RCww_1hsxh17R1Z6QjmVcmdDebPKR1QEY_pNwBxt5vg"
    }
]

/*
    canClaim is looking to match the txID, to, and qty keys in the 'claimable' object of the player.  You can see it's there, but it's not matching in the contract.
 */
```

My results are saved in the /results folder.

I hope this helps identify the problem.  Please let me know if you have questions or need clarification.
