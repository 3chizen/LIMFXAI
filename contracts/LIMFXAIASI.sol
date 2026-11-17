// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract LIMFXAIASI {
    address public owner;
    address public agent;
    bytes32 public identityCommitment;
    bytes32 public buildHash;
    uint256 public taskCount;
    bool public active;

    struct Task {
        bytes32 inputHash;
        bytes32 resultHash;
        uint64 createdAt;
        uint64 completedAt;
        uint8 status;
    }

    mapping(uint256 => Task) public tasks;

    event AgentRegistered(address indexed agent, bytes32 identityCommitment);
    event AgentStatusChanged(bool active);
    event TaskCreated(uint256 indexed id, bytes32 inputHash);
    event TaskCompleted(uint256 indexed id, bytes32 resultHash);
    event CheckpointPublished(bytes32 memoryRoot, bytes32 knowledgeRoot, bytes32 buildHash);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    modifier onlyAgent() {
        require(msg.sender == agent && active, "Agent unavailable");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function registerAgent(address signer, bytes32 identityHash, bytes32 codeHash) external onlyOwner {
        require(signer != address(0), "Invalid signer");
        agent = signer;
        identityCommitment = identityHash;
        buildHash = codeHash;
        active = true;
        emit AgentRegistered(signer, identityHash);
    }

    function setActive(bool enabled) external onlyOwner {
        active = enabled;
        emit AgentStatusChanged(enabled);
    }

    function createTask(bytes32 inputHash) external onlyOwner returns (uint256 id) {
        require(agent != address(0), "Agent not registered");
        id = ++taskCount;
        tasks[id] = Task(inputHash, bytes32(0), uint64(block.timestamp), 0, 1);
        emit TaskCreated(id, inputHash);
    }

    function completeTask(uint256 id, bytes32 resultHash) external onlyAgent {
        Task storage t = tasks[id];
        require(t.status == 1, "Task not pending");
        require(resultHash != bytes32(0), "Empty result");
        t.resultHash = resultHash;
        t.completedAt = uint64(block.timestamp);
        t.status = 2;
        emit TaskCompleted(id, resultHash);
    }

    function publishCheckpoint(bytes32 memoryRoot, bytes32 knowledgeRoot, bytes32 codeHash) external onlyAgent {
        require(memoryRoot != bytes32(0) && knowledgeRoot != bytes32(0), "Invalid root");
        buildHash = codeHash;
        emit CheckpointPublished(memoryRoot, knowledgeRoot, codeHash);
    }

    function transferOwnership(address next) external onlyOwner {
        require(next != address(0), "Invalid owner");
        emit OwnershipTransferred(owner, next);
        owner = next;
    }
}
