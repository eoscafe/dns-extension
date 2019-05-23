function sleep(milliseconds, host) {
	var start = new Date().getTime();
	for (var i = 0; i < 1e7; i++) {
    if (((new Date().getTime() - start) > milliseconds) || 
         !sessionStorage.getItem(host)) {
			break;
		}
	}
}

function searchToAccount (url, testQuery) {
  const test = url.match(testQuery);
  if (test && test.length) {
    let account = test[1].toLowerCase()

    if (account.length <= 12 && RegExp('^[a-z12345.]+$').test(account)) {
      return account
    }
  }

  return ''
}

function getDnsRecords (account, host) {
  const xhr = new XMLHttpRequest();
  const url = "https://api.jungle.alohaeos.com/v1/chain/get_table_rows";
  xhr.open("POST", url, true);
  xhr.setRequestHeader("Content-Type", "application/json");
  xhr.onreadystatechange = function () {
    if (xhr.readyState === 4 && xhr.status === 200) {
      const json = JSON.parse(xhr.responseText);

      if (json.rows && json.rows.length) {
        console.log(json.rows)
        // Redirect if found
        let HTTPREDRecord = json.rows.find(
          record => record.type.trim() === 'HTTPRED' && record.name.trim() === host + '.'
        )
        if (HTTPREDRecord) {
          chrome.tabs.query({ active: true, currentWindow: true }, function(tab) {
            chrome.tabs.update(tab[0].id, { url: HTTPREDRecord.value });
          });
          return
        }

        // Standard A record
        let ARecords = json.rows.filter(
          record => record.type.trim() === 'A' && record.name.trim() === host + '.'
        )
        if (ARecords.length) {
          let ip = ARecords[0].value
          let ttl = ARecords[0].ttl
          sessionStorage.setItem(host, ip);
          sessionStorage.setItem(`${host}_ttl`, (new Date().getTime() / 1000) + ttl);
          return
        }
      }
    }
  };

  const data = JSON.stringify({
    "json": true,
    "code": "eosdnseosdns",
    "scope": account,
    "table": "dns",
    "limit": 25
  });
  xhr.send(data);
}

chrome.webRequest.onBeforeRequest.addListener(
  function(details) {
    const { url } = details

    // The eos account
    let account

    // For .eos search (without slash)
    if (url.indexOf('.eos') !== -1 && url.indexOf('.eos/') === -1) {
      account = searchToAccount(url, "=(.*?).eos\&")
    // For eos:// search
    } else if (url.indexOf('eos%3A%2F%2F') !== -1) {
      account = searchToAccount(url, "=eos%3A%2F%2F(.*?)\&")
      chrome.tabs.query({ active: true, currentWindow: true }, function(tab) {
        chrome.tabs.update(tab[0].id, { url: `http://${account}.eos` });
      });
      return
    // For full domain
    } else if (url.indexOf('.eos') !== -1) {
      account = searchToAccount(url, "//(.*?)\.eos")
    }

    if (!account) return

    // Create parser
    const parser = document.createElement("a");
    parser.href = url;
    const domain = parser.hostname;

    // Protocol
    const port = (parser.protocol === "https:" ? "443" : "80");
    const access = (parser.protocol === "https:" ? "HTTPS" : "PROXY");
    const tld = parser.hostname.slice(-3);
    if (tld != 'eos') return

    // IP to go to
    let storedItem = sessionStorage.getItem(domain)
    let storedItemTtl = sessionStorage.getItem(`${domain}_ttl`)
    let currentTimeInSeconds = new Date().getTime() / 1000
    if (!storedItem || !storedItemTtl || storedItemTtl < currentTimeInSeconds) {
      getDnsRecords(account, domain)
      sleep(10000, domain)
    }
    let ip = sessionStorage.getItem(domain);
    if (!ip) return

    const config = {
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
      { value: config, scope: "regular" },
      function() {
        console.log(url);
        console.log(config);
        // console.log("Proxy config is set.");
      }
    );
  },
  { urls: ["<all_urls>"] },
  ["blocking"]
);

/**
 * For tab eos
 */
chrome.omnibox.onInputEntered.addListener(function(account) {
  if (RegExp('^[a-zA-Z12345.]+$').test(account)) {
    chrome.tabs.query({ active: true, currentWindow: true }, function(tab) {
      chrome.tabs.update(tab[0].id, { url: `http://${account}.eos` });
    });
  }
});