import Web3 from "web3";
import BN from "bn.js";
import { ErasureDaily, ERASE, ContractArtifact } from "erasure-daily-contracts";

async function instanceOf(web3: Web3, artifact: ContractArtifact) {
  const networkVersion = await web3.eth.net.getId();
  const { address, transactionHash } = (artifact.networks[
    networkVersion.toString()
  ] || {}) as { address: string; transactionHash: string };

  const contract = new web3.eth.Contract(artifact.abi, address);
  (contract as any).transactionHash = transactionHash;
  return contract as any;
}

export interface Prediction {
  nonce: string;
  user: string;
  userPublicKey: string;
  encryptedPrediction: string;
  stake: string;
  reward: string;
  rewardWithdrawn: boolean;
  prediction?: number; // Decrypted
}

export interface Round {
  creator: string;
  oracle: string;
  createdAt: string;
  opensAt: string;
  closesAt: string;
  revealsAt: string;
  publicKey: string;
  revealSecret: string;
  totalStake: string;
  roundReward: string;
  isOver: boolean;
  metadata: string;
  optionCount: string;
}

interface Web3TransactionPromise extends Promise<string> {
  on(event: string, func: (...args: any[]) => void): Web3TransactionPromise;
}

interface Web3Transaction<T = string> {
  send(opts: any): Web3TransactionPromise;
  call(): Promise<T>;
  estimateGas(): Promise<BN>;
}

interface ErasureDailyContract {
  _address: string;
  methods: {
    getRound(id: BN): Web3Transaction<Round>;
    getOpenRounds(): Web3Transaction<BN[]>;
    getPrediction(predictionId: BN): Web3Transaction<Prediction>;
    getPredictionsPerRound(roundId: BN): Web3Transaction<BN[]>;
    getUserRewardPerRound(
      address: string,
      roundId: BN,
      proof: string[]
    ): Web3Transaction<BN>;
    createPrediction(
      roundId: BN,
      nonce: BN,
      encryptedPrediction: BN,
      stake: BN
    ): Web3Transaction;
    createRound(
      oracle: string,
      publicKey: BN,
      options: BN,
      opensAt: BN,
      closesAt: BN,
      revealsAt: BN,
      reward: BN,
      ipfsHashHex: string
    ): Web3Transaction;
    updateRoundResults(
      roundId: BN,
      revealSecret: BN,
      winningOption: BN,
      totalStakedByWinners: BN,
      totalStakedByLosers: BN,
      winningMerkleRoot: string,
      losingMerkleRoot: string
    ): Web3Transaction;
  };
}

interface EraseContract {
  _address: string;
  methods: {
    approveAll(address: string, opts?: any): Web3Transaction;
  };
}

export default class Contracts {
  daily: ErasureDailyContract;
  erase: EraseContract;

  static async build(web3: Web3) {
    const contracts = new Contracts();
    contracts.daily = (await instanceOf(
      web3,
      ErasureDaily
    )) as ErasureDailyContract;
    contracts.erase = (await instanceOf(web3, ERASE)) as EraseContract;
    return contracts;
  }
}
