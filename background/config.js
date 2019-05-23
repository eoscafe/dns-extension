var config = {
  nodeUrl: 'https://eos.eoscafeblock.com',
  contract: 'eosdns.x'
}

const loadConfig = () => {
  chrome.storage.local.get(Object.keys(config), function(result) {
    if (result) {
      config = result
    }
  });
}
const saveConfig = () => chrome.storage.local.set(config)
const updateConfig = (newConfig = {}) => {
  console.log('Old config:', config, 'New Config:', Object.assign({}, config, newConfig))
  config = Object.assign({}, config, newConfig)
  saveConfig()
}

chrome.runtime.onInstalled.addListener((response) => {
  if (response.reason === 'install') {
    updateConfig()
  } else {
    loadConfig()
  }
})
chrome.runtime.onStartup.addListener(loadConfig)
chrome.runtime.onMessage.addListener(async message => {
  if (message.getConfig) {
    chrome.runtime.sendMessage(config)
  } else if (message.nodeUrl || message.contract) {
    updateConfig(message)
  }
})