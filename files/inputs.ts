
interface LimitInterface {
    position: 'qb' | 'rb' | 'wr' | 'd' | 'k';
    starterLimit: number;
    benchLimit: number;
}
  
interface TeamInterface {
    starters?: PlayerInterface[];
    bench?: PlayerInterface[];
}
  
interface PlayerInterface {
    id: string;
    position: 'qb' | 'rb' | 'wr' | 'd' | 'k';
}

const teamLimits: LimitInterface[] = [
    { position: 'qb', starterLimit: 1, benchLimit: 1 },
    { position: 'rb', starterLimit: 2, benchLimit: 2 },
    { position: 'wr', starterLimit: 3, benchLimit: 2 },
    { position: 'k', starterLimit: 1, benchLimit: 1 },
    { position: 'd', starterLimit: 1, benchLimit: 1 },
  ];
  
const team: TeamInterface = {
    starters: [
        { id: '1', position: 'qb' },
        { id: '2', position: 'rb' },
        { id: '21', position: 'rb' },
        { id: '3', position: 'wr' },
        { id: '31', position: 'wr' },
        { id: '32', position: 'wr' },
    ],
    bench: [
        { id: '7', position: 'rb' },
        { id: '4', position: 'rb' },
        { id: '5', position: 'wr' },
        { id: '6', position: 'wr' },
        { id: '11', position: 'qb' },
    ],
};

interface StateInterface {
    name: string;
    tokens?: [ TokenInterface ] | [];
    teamSetup: TeamInterface;
    teamLimits: LimitInterface[];
}

interface TokenInterface {
    txID: string;
    tokenId: string;
    source: string;
    balance: number;
    start: number;          
    lockLength?: number;
}
