import Web3 from "web3";
import { ErasureDaily, ERASE, ContractArtifact } from "erasure-daily-contracts";

async function instanceOf(web3: Web3, artifact: ContractArtifact) {
  const networkVersion = await web3.eth.net.getId();
  const { address, transactionHash } = (artifact.networks[
    networkVersion.toString()
  ] || {}) as { address: string; transactionHash: string };

  const contract = new web3.eth.Contract(artifact.abi, address);
  (contract as any).transactionHash = transactionHash;
  return contract;
}

export default class Contracts {
  daily: any;
  erase: any;

  static async build(web3: Web3) {
    const contracts = new Contracts();
    contracts.daily = await instanceOf(web3, ErasureDaily);
    contracts.erase = await instanceOf(web3, ERASE);
    return contracts;
  }
}
