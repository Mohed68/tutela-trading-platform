import crypto from "crypto";

export interface SmartContractData {
  id: string;
  buyerId: string;
  sellerId: string;
  quantity: string;
  totalPrice: string;
  terms: any;
  deliveryDate?: Date;
}

export interface BlockchainTransaction {
  txHash: string;
  blockNumber: number;
  status: "pending" | "confirmed" | "failed";
  gasUsed: number;
  timestamp: Date;
}

export interface ContractStatus {
  status: "deployed" | "active" | "executed" | "cancelled";
  txHash: string;
  blockNumber: number;
  events: Array<{
    event: string;
    timestamp: Date;
    data: any;
  }>;
}

// Mock blockchain service - simulates smart contract deployment and management
class MockBlockchainService {
  private contracts: Map<string, SmartContractData & BlockchainTransaction> = new Map();
  private currentBlockNumber = 1000000;

  private generateTxHash(): string {
    return "0x" + crypto.randomBytes(32).toString("hex");
  }

  private generateBlockNumber(): number {
    return ++this.currentBlockNumber;
  }

  async deployContract(contractData: SmartContractData): Promise<string> {
    const txHash = this.generateTxHash();
    const blockNumber = this.generateBlockNumber();
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const transaction: BlockchainTransaction = {
      txHash,
      blockNumber,
      status: "confirmed",
      gasUsed: Math.floor(Math.random() * 100000) + 50000,
      timestamp: new Date(),
    };

    this.contracts.set(txHash, {
      ...contractData,
      ...transaction,
    });

    console.log(`Smart contract deployed: ${txHash} at block ${blockNumber}`);
    
    return txHash;
  }

  async getContractStatus(txHash: string): Promise<ContractStatus> {
    const contract = this.contracts.get(txHash);
    
    if (!contract) {
      throw new Error("Contract not found");
    }

    // Simulate contract lifecycle events
    const events = [
      {
        event: "ContractCreated",
        timestamp: contract.timestamp,
        data: {
          buyer: contract.buyerId,
          seller: contract.sellerId,
          amount: contract.totalPrice,
          quantity: contract.quantity,
        }
      },
      {
        event: "TermsAgreed",
        timestamp: new Date(contract.timestamp.getTime() + 300000), // 5 min later
        data: {
          terms: contract.terms,
        }
      }
    ];

    // Add delivery event if delivery date has passed
    if (contract.deliveryDate && contract.deliveryDate < new Date()) {
      events.push({
        event: "DeliveryCompleted",
        timestamp: contract.deliveryDate,
        data: {
          quantity: contract.quantity,
          location: contract.terms?.deliveryLocation || "Unknown",
        }
      });
    }

    return {
      status: this.determineContractStatus(contract),
      txHash: contract.txHash,
      blockNumber: contract.blockNumber,
      events,
    };
  }

  private determineContractStatus(contract: SmartContractData & BlockchainTransaction): "deployed" | "active" | "executed" | "cancelled" {
    const now = new Date();
    const contractAge = now.getTime() - contract.timestamp.getTime();
    
    // Contract is active for first 24 hours
    if (contractAge < 24 * 60 * 60 * 1000) {
      return "active";
    }
    
    // If delivery date has passed, consider it executed
    if (contract.deliveryDate && contract.deliveryDate < now) {
      return "executed";
    }
    
    return "deployed";
  }

  async executeContract(txHash: string, executionData: any): Promise<string> {
    const contract = this.contracts.get(txHash);
    
    if (!contract) {
      throw new Error("Contract not found");
    }

    const executionTxHash = this.generateTxHash();
    const blockNumber = this.generateBlockNumber();
    
    // Simulate execution delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log(`Contract executed: ${executionTxHash} (original: ${txHash})`);
    
    return executionTxHash;
  }

  async cancelContract(txHash: string, reason: string): Promise<string> {
    const contract = this.contracts.get(txHash);
    
    if (!contract) {
      throw new Error("Contract not found");
    }

    const cancellationTxHash = this.generateTxHash();
    const blockNumber = this.generateBlockNumber();
    
    // Simulate cancellation delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    console.log(`Contract cancelled: ${cancellationTxHash} (original: ${txHash}), reason: ${reason}`);
    
    return cancellationTxHash;
  }

  // Utility method to get network stats (for dashboard display)
  async getNetworkStats(): Promise<{
    blockNumber: number;
    gasPrice: number;
    networkHashRate: string;
    totalContracts: number;
  }> {
    return {
      blockNumber: this.currentBlockNumber,
      gasPrice: Math.floor(Math.random() * 50) + 20, // 20-70 gwei
      networkHashRate: (Math.random() * 100 + 150).toFixed(2) + " TH/s",
      totalContracts: this.contracts.size,
    };
  }
}

const blockchainService = new MockBlockchainService();

// Export functions that use the mock service
export async function createSmartContract(contractData: SmartContractData): Promise<string> {
  try {
    return await blockchainService.deployContract(contractData);
  } catch (error) {
    console.error("Failed to create smart contract:", error);
    throw new Error("Smart contract deployment failed");
  }
}

export async function getContractStatus(txHash: string): Promise<ContractStatus> {
  try {
    return await blockchainService.getContractStatus(txHash);
  } catch (error) {
    console.error("Failed to get contract status:", error);
    throw new Error("Failed to retrieve contract status");
  }
}

export async function executeContract(txHash: string, executionData: any): Promise<string> {
  try {
    return await blockchainService.executeContract(txHash, executionData);
  } catch (error) {
    console.error("Failed to execute contract:", error);
    throw new Error("Contract execution failed");
  }
}

export async function cancelContract(txHash: string, reason: string): Promise<string> {
  try {
    return await blockchainService.cancelContract(txHash, reason);
  } catch (error) {
    console.error("Failed to cancel contract:", error);
    throw new Error("Contract cancellation failed");
  }
}

export async function getBlockchainStats(): Promise<{
  blockNumber: number;
  gasPrice: number;
  networkHashRate: string;
  totalContracts: number;
}> {
  try {
    return await blockchainService.getNetworkStats();
  } catch (error) {
    console.error("Failed to get blockchain stats:", error);
    return {
      blockNumber: 0,
      gasPrice: 0,
      networkHashRate: "Unknown",
      totalContracts: 0,
    };
  }
}
