// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Add {
    uint256 public value;

    event ValueChanged(uint256 newValue, address changedBy);

    constructor(uint256 initialValue) {
        value = initialValue;
    }

    function set(uint256 newValue) public {
        value = newValue;
        emit ValueChanged(newValue, msg.sender);
    }

    function get() public view returns (uint256) {
        return value;
    }
}
