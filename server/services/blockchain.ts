// Mock blockchain service for smart contracts
export interface SmartContractResult {
  contractAddress: string;
  status: "pending" | "deployed" | "failed";
  simulation: true;
}

export interface ContractStatus {
  contractAddress: string;
  status: SmartContractResult["status"];
  simulation: true;
}

export async function createSmartContract(
  contractData: {
    buyerId: string;
    sellerId: string;
    commodity: string;
    quantity: string;
    price: string;
    terms: {
      paymentTerms: string | null;
      deliveryTerms: string | null;
      specifications: string | null;
    };
  }
): Promise<SmartContractResult> {
  // Simulate smart-contract deployment delay.
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // This address identifies only the local simulation; no on-chain transaction occurs.
  const contractAddress = `0x${Math.random().toString(16).substr(2, 40)}`;
  
  return {
    contractAddress,
    status: "deployed",
    simulation: true,
  };
}

export async function getContractStatus(contractAddress: string): Promise<ContractStatus> {
  // Simulate a status query delay.
  await new Promise(resolve => setTimeout(resolve, 500));
  
  return {
    contractAddress,
    status: "deployed",
    simulation: true,
  };
}
