// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract SimpleTextStorage {
    string public storedText;

    event TextUpdated(string newText);

    function setText(string memory newText) public {
        storedText = newText;
        emit TextUpdated(newText);
    }

    function getText() public view returns (string memory) {
        return storedText;
    }
}
