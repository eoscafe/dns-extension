window.addEventListener("DOMContentLoaded", event => {
  console.log("EOSDNS fully loaded and parsed");
  const nodeUrlInput = document.getElementById("node_url")
  const contractInput = document.getElementById("contract")
  const dataSubmit = document.getElementById("update_data")

  // If submitted, update
  dataSubmit.addEventListener("click", function(){
    chrome.runtime.sendMessage({ 
        nodeUrl: nodeUrlInput.value,
        contract: contractInput.value
    })
  });

  // Initialize config request and update
  chrome.runtime.sendMessage({
    getConfig: true
  })

  chrome.runtime.onMessage.addListener(async message => {
    if (message.nodeUrl && message.contract) {
      nodeUrlInput.value = message.nodeUrl;
      contractInput.value = message.contract;
    }
  });
});
