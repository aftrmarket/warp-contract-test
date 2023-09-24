import ArLocal from 'arlocal';
import fs, { read } from "fs";
import path from "path";
import { arweaveInit, warpCreateNewContract, warpCreateContractFromTx, warpRead, warpWrite, warpCreateSource } from "../utils/warp.js";

jest.setTimeout(30000);

describe('Testing Purchase Player Process', () => {
    const env = "DEV";  // "DEV" | "TEST" | "PROD"
    const arweave = arweaveInit(env);
    const __dirname = path.resolve();
    const mine = () => arweave.api.get("mine");
    let arlocal = {};
    let cache = true;
    let withoutRejects = true;     // Do not use 'rejects' -> set to true

    let wallet = {};
    let walletAddr = "";
    
    const contracts = {
        gameCurrencyId: "",
        playerRegistryId: "",
        playerSourceId: "",
        teamSourceId: ""
    };

    let teamId1 = "";
    let teamId2 = "";
    let purchasePlayerId = "";
    let contractRead1 = "";
    let contractRead2 = "";
    let contractRead1NoCache = "";
    let contractRead2NoCache = "";

    const gameCurrentContractSrc = "/contracts/contract-work.js";
    const gameCurrencyInitState = {
        "name" : "Work",
        "ticker" : "WORK",
        "balances" : { "bAJYgxGXt9KE4g8H7l7u80iFaBIgzpUQNUgycJby0lU": 100000000 },
        "vault" : {},
        "claimable": [],
        "claims": [],
        "evolve": "",
        "settings" : [
            [ "quorum", 0.5 ],
            [ "support", 0.5],
            [ "voteLength", 2000 ],
            [ "communityAppUrl", "" ],
            [ "communityDiscussionLinks", "" ],
            [ "communityDescription", "Test currency." ],
            [ "communityLogo", "iLPUUQvjA0jPH9VGjTsMkaxBbh_WnwRuqp6WhE_M3Ag"]
        ]
    };

    const playerRegContractSrc = "/contracts/contract-player-reg.js";
    
    const playerContractSrc= "/contracts/builds/contract-player.js";
    const teamContractSrc= "/contracts/builds/contract-team.js";

    let playerFileName = env === "DEV" ? "/files/playerReg-dev.json" : "/files/playerReg-test.json";;
    const playerData = fs.readFileSync(path.join(__dirname, playerFileName), "utf8");
    const playerNames = JSON.parse(playerData);

    const updateContractFile = (regId, contractType, placeholderName) => {
        const contractFilePath = path.join(__dirname, "contracts", "builds", `contract-${contractType}.js`);
    
        try {
            let fileContent = fs.readFileSync(contractFilePath, "utf8");
    
            // Replace the placeholder with the regId value
            const placeholder = placeholderName;
            fileContent = fileContent.replace(placeholder, regId);
    
            fs.writeFileSync(contractFilePath, fileContent);
    
            console.log(`Updated contract file: ${contractFilePath}`);
        } catch (error) {
            console.error(`Failed to update contract file: ${contractFilePath}`, error);
        }
    };
    
    const copyFile = (sourcePath, destinationPath) => {
        try {
            // Read the content of the source file
            const fileContent = fs.readFileSync(sourcePath);
    
            // Write the content to the destination file, overwriting it if it exists
            fs.writeFileSync(destinationPath, fileContent);
    
            console.log(`Copied ${sourcePath} to ${destinationPath}`);
        } catch (error) {
            console.error(`Failed to copy ${sourcePath} to ${destinationPath}`, error);
        }
    };

    async function buyPlayer(teamId) {
        // Get a Player ID
        const playerReg = await warpRead(contracts.playerRegistryId, env);
        const player = playerReg.cachedValue.state.register.find( (p) => p.meta.name === "Zay Flowers");
        purchasePlayerId = player.id;

        let input = {
            function: "allow",
            target: purchasePlayerId,
            qty: player.price,
        };
        const tx1 = await warpWrite(contracts.gameCurrencyId, input, wallet, env);

        input = {
            function: "deposit",
            tokenId: contracts.gameCurrencyId,
            txID: tx1.originalTxId,
            target: teamId,
            qty: player.price,
        };
        const tx2 = await warpWrite(purchasePlayerId, input, wallet, env);

        // Add player to Team
        input = {
            function: "allow",
            target: teamId,
            qty: 1,
        };
        const tx3 = await warpWrite(purchasePlayerId, input, wallet, env);

        console.log(`***** TX3 ${tx3.originalTxId}`);

        input = {
            function: "deposit",
            tokenId: purchasePlayerId,
            txID: tx3.originalTxId,
            qty: 1,
        };
        const tx4 = await warpWrite(teamId, input, wallet, env);

        console.log(`***** TX4 ${tx4.originalTxId}`);
    }

    beforeAll(async () => {
        // arlocal = new ArLocal();
        // await arlocal.start();

        wallet = JSON.parse(fs.readFileSync(path.join(__dirname, "./dev/test-wallet.json")));
        walletAddr = await arweave.wallets.getAddress(wallet);
    
        // Airdrop amount of tokens (in winston) to wallet
        if (env === "DEV") {
            await arweave.api.get(`mint/${walletAddr}/10000000000000000`);
            await mine();
        }
    });

    afterAll(async () => {
        // await arlocal.stop();

        let playerState = await warpRead(purchasePlayerId, env, cache);

        console.log(contracts);
        console.log(`Player ID: ${purchasePlayerId}`);
        console.log(`Team ID 1: ${teamId1}`);
        console.log(`Team ID 2: ${teamId2}`);
        console.log(`Team Contract 1 with Cache: ${contractRead1}`);
        console.log(`Team Contract 2 with Cache: ${contractRead2}`);
        console.log(`Player Contract: ${JSON.stringify(playerState)}`);

        if (env !== "DEV") {
            console.log(`Team Contract 1: ${contractRead1NoCache}`);
            console.log(`Team Contract 2: ${contractRead2NoCache}`);
        }
      });

    it('Should deploy Player Registry Contract', async () => {
        let contractSource = fs.readFileSync(path.join(__dirname, playerRegContractSrc), "utf8");
        let initState = {
            register: [], 
            season: "2022"
        };
        
        contracts.playerRegistryId = await warpCreateNewContract(contractSource, initState, wallet, env);
        const result = await warpRead(contracts.playerRegistryId, env);
        
        // expect(contracts.playerRegistryId).not.toBe('');
        expect(result.cachedValue.state).toEqual(initState);
    });

    it('Should deploy Game Currency', async () => {
        const contractSource = fs.readFileSync(path.join(__dirname, gameCurrentContractSrc), "utf8");
        contracts.gameCurrencyId = await warpCreateNewContract(contractSource, gameCurrencyInitState, wallet, env);

        const result = await warpRead(contracts.gameCurrencyId, env);
        expect(result.cachedValue.state).toEqual(gameCurrencyInitState);

        // expect(contracts.gameCurrencyId).not.toBe('');
    });

    it('Should deploy Player and Team Contract Sources', async () => {
        // Copy source files and update placeholders
        let filename = "contract-source.js";
        if (withoutRejects) {
            filename = "contract-source-wo-reject.js";
        }

        let contractType = "player";
        let srcPath = path.join(__dirname, "contracts", "sources", contractType, filename);
        let destPath = path.join(__dirname, "contracts", `builds/contract-${contractType}.js`);
        copyFile(srcPath, destPath);
        updateContractFile(contracts.gameCurrencyId, contractType, "<GAME CURRENCY PLACEHOLDER>");
        updateContractFile(contracts.playerRegistryId, contractType, "<PLAYER REGISTRY PLACEHOLDER>");

        contractType = "team";
        srcPath = path.join(__dirname, "contracts", "sources", contractType, filename);
        destPath = path.join(__dirname, "contracts", `builds/contract-${contractType}.js`);
        copyFile(srcPath, destPath);
        updateContractFile(contracts.gameCurrencyId, contractType, "<GAME CURRENCY PLACEHOLDER>");
        updateContractFile(contracts.playerRegistryId, contractType, "<PLAYER REGISTRY PLACEHOLDER>");

        // Create sources
        let contractSource = fs.readFileSync(path.join(__dirname, playerContractSrc), "utf8");
        contracts.playerSourceId = await warpCreateSource(contractSource, wallet, env);

        contractSource = fs.readFileSync(path.join(__dirname, teamContractSrc), "utf8");
        contracts.teamSourceId = await warpCreateSource(contractSource, wallet, env);

        expect(contracts.playerSourceId).not.toBe('');
        expect(contracts.teamSourceId).not.toBe('');
    });

    it('Should create and register Players', async () => {
        let count = 0;
        for (const player of playerNames) {
            const playerPosition = player.position === "te" ? "wr" : player.position;
            const playerInitState = {
                "meta": {
                  "season": "2022"
                },
                "name": player.name,
                "orgId": player.orgid,
                "owner": "bAJYgxGXt9KE4g8H7l7u80iFaBIgzpUQNUgycJby0lU",
                "price": 1000000,
                "votes": [],
                "claims": [],
                "scores": [],
                "status": "started",
                "ticker": player.ticker,
                "tokens": [],
                "balances": { "bAJYgxGXt9KE4g8H7l7u80iFaBIgzpUQNUgycJby0lU": 1 },
                "position": playerPosition,
                "settings": [
                  [ "quorum", 0.5 ],
                  [ "support", 0.51 ],
                  [ "voteLength", 2160 ],
                  [ "communityLogo", "" ]
                ],
                "claimable": [],
                "ownership": "single",
                "protected": [ "protected", "scores", "purchaseLog", "price" ],
                "purchaseLog": [],
                "divisibility": 1000000,
                "votingSystem": "weighted",
                "beneficiaryId": "bAJYgxGXt9KE4g8H7l7u80iFaBIgzpUQNUgycJby0lU",
                "priceIncrement": 10000
            };

            // Create Player contract
            let playerId = "";
            try {
                playerId = await warpCreateContractFromTx(contracts.playerSourceId, playerInitState, wallet, env);
                console.log(`Player created ${playerId}`);
            } catch(e) {
                console.log(`ERROR CREATING PLAYER: ${e}`)
                continue;
            }

            // Register Player
            const regInput = {
                function: "register",
                value: {
                    id: playerId,
                    meta: {
                        name: player.name,
                        position: playerPosition,
                        orgId: player.orgid,
                        verified: false,
                        repoId: player.beneficiaryId
                    },
                    scores: [],
                    price: 1000000
                }
            };
            try {
                const respTxId = await warpWrite(contracts.playerRegistryId, regInput, wallet, env);
            } catch (e) {
                console.log(`ERROR REGISTERING PLAYER: ${e}`)
                continue;
            }

            count++;
        }

        if (env === "DEV") {
            expect(count).toBe(50);
        } else {
            expect(count).toBe(1);
        }
    });

    it('Create 2 Teams', async () => {
        const teamInitState = fs.readFileSync(path.join(__dirname, "/files/team.json"), "utf8");
        const team1 = JSON.parse(teamInitState);
        team1.name = "Team1";
        team1.ticker = "TEAM1";

        const team2 = JSON.parse(teamInitState);
        team2.name = "Team2";
        team2.ticker = "TEAM2"

        teamId1 = await warpCreateContractFromTx(contracts.teamSourceId, team1, wallet, env);
        teamId2 = await warpCreateContractFromTx(contracts.teamSourceId, team2, wallet, env);

        const team1State = await warpRead(teamId1, env, cache);
        const team2State = await warpRead(teamId2, env, cache);

        expect(team1State.cachedValue.state).toEqual(team1);
        expect(team2State.cachedValue.state).toEqual(team2);
        // expect(teamId1).not.toBe('');
        // expect(teamId2).not.toBe('');
    });

    it('Purchase Player for Team 1', async () => {
        await buyPlayer(teamId1);
        const result1 = await warpRead(teamId1, env);
        contractRead1 = JSON.stringify(result1);
        expect (result1.cachedValue.errorMessages).toEqual({});
        expect (result1.cachedValue.state).not.toHaveProperty('reject', true);

        if (env !== "DEV") {
            const result11 = await warpRead(teamId1, env, false);
            contractRead1NoCache = JSON.stringify(result11);
            expect (result11.cachedValue.errorMessages).toEqual({});
        }
    });

    it('Purchase Player for Team 2', async () => {
        await buyPlayer(teamId2);
        const result2 = await warpRead(teamId2, env);
        contractRead2 = JSON.stringify(result2);
        expect (result2.cachedValue.errorMessages).toEqual({});
        expect (result2.cachedValue.state).not.toHaveProperty('reject', true);

        if (env !== "DEV") {
            const result22 = await warpRead(teamId2, env, false);
            contractRead2NoCache = JSON.stringify(result22);
            expect (result22.cachedValue.errorMessages).toEqual({});
        }
    });
});


