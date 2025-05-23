// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Voting {
    address public owner;
    bool public votingActive;

    struct Candidate {
        uint id;
        string name;
        uint voteCount;
    }

    struct Voter {
        bool isRegistered;
        bool hasVoted;
        uint votedFor;
    }

    mapping(uint => Candidate) public candidates;
    mapping(address => Voter) public voters;

    uint public candidateCount;

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner can call this.");
        _;
    }

    modifier onlyRegistered() {
        require(voters[msg.sender].isRegistered, "Not a registered voter.");
        _;
    }

    constructor() {
        owner = msg.sender;
        votingActive = false;
    }

    function addCandidate(string memory name) external onlyOwner {
        candidateCount++;
        candidates[candidateCount] = Candidate(candidateCount, name, 0);
    }

    function registerVoter(address voter) external onlyOwner {
        voters[voter].isRegistered = true;
    }

    function startVoting() external onlyOwner {
        votingActive = true;
    }

    function endVoting() external onlyOwner {
        votingActive = false;
    }

    function vote(uint candidateId) external onlyRegistered {
        require(votingActive, "Voting is not active.");
        require(!voters[msg.sender].hasVoted, "You have already voted.");
        require(candidateId > 0 && candidateId <= candidateCount, "Invalid candidate.");

        voters[msg.sender].hasVoted = true;
        voters[msg.sender].votedFor = candidateId;
        candidates[candidateId].voteCount++;
    }

    function getCandidate(uint candidateId) external view returns (string memory name, uint voteCount) {
        require(candidateId > 0 && candidateId <= candidateCount, "Invalid candidate.");
        Candidate storage c = candidates[candidateId];
        return (c.name, c.voteCount);
    }
}
