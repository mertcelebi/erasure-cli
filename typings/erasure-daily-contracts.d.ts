declare module "erasure-daily-contracts" {
  export type ContractArtifact = {
    abi: any[];
    networks: {
      [id: string]: { address: string; transactionHash: string };
    };
  };

  export const ErasureDaily: ContractArtifact;
  export const ERASE: ContractArtifact;
}
