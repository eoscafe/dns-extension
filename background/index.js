function setPac (domain, access, ip, port) {
  const pacConfig = {
    mode: "pac_script",
    pacScript: { 
      data: `function FindProxyForURL(url, host) {
        if (dnsDomainIs(host, '${domain}'))
          return '${access} ${ip}:${port}';
        
        return 'DIRECT';
      }`
    }
  };

  chrome.proxy.settings.set(
    { value: pacConfig, scope: "regular" },
    function() {
      console.log(pacConfig);
      // console.log("Proxy config is set.");
    }
  );
}

chrome.webRequest.onBeforeRequest.addListener(
  function(details) {
    const { url } = details
    console.log(details)

    // The eos account
    let { account, redirectUrl } = urlToAccount(url)
    if (redirectUrl) return { redirectUrl }
    if (!account) return

    // Parse URL
    const { access, domain, tld, port } = parseURL(url)
    if (tld !== 'eos') return

    function dnsRecordsResultHandler (result) {
      console.log('RESULT', result)
      sessionStorage.setItem(domain, JSON.stringify(result))

      setPac(domain, access, result.ip, port)

      if (result.error) {
        sessionStorage.setItem(domain, null)
        return
      } else if (result.redirectUrl) {
        return { redirectUrl: result.redirectUrl }
      }
    }

    // Check if fresh IP exists, otherwise fetch
    let unparsedRecord = sessionStorage.getItem(domain);
    let parsedRecord

    if (unparsedRecord) {
      parsedRecord = JSON.parse(unparsedRecord)
      if (parsedRecord && parsedRecord.redirectUrl) return { redirectUrl: parsedRecord.redirectUrl }
    }

    const currentTimeInSeconds = new Date().getTime() / 1000
    if (!parsedRecord || !parsedRecord.ip || !parsedRecord.expiry || parsedRecord.expiry < currentTimeInSeconds) {
      getDnsRecords(config.nodeUrl, config.contract, account, domain, dnsRecordsResultHandler)
    } else {
      setPac(domain, access, parsedRecord.ip, port)
    }
  },
  { urls: ["<all_urls>"] },
  ["blocking"]
);

/**
 * For tab eos
 */
(() => {

})
chrome.omnibox.onInputEntered.addListener(function(account) {
  if (RegExp('^[a-zA-Z12345.]+$').test(account)) {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tab) {
      chrome.tabs.update(tab[0].id, { url: `http://${account}.eos` });
    });
  }
});