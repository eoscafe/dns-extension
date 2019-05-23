function parseURL(url) {
  var match = (url || '')
      .match(/^(\w+):\/\/[^\/]*?([\w.-]+)(:(\d+))?(\/|$)/);
  if (match) {
      return {
          url: url,
          scheme: match[1],
          access: match[1] === "https" ? "HTTPS" : "PROXY",
          domain: match[2],
          tld: match[2].match(/[^.]+$/)[0],
          port: match[1] === "https" ? "443" : "80"
      };
  }
}

function urlToAccount (url) {
    let response = {
      account: undefined,
      redirectUrl: undefined
    }

    // For .eos search (without slash)
    if (url.indexOf('.eos&') !== -1) {
      response.account = searchToAccount(url, "=(.*?)\.eos\&")
      response.redirectUrl = `http://${response.account}.eos`
    // For eos:// search
    } else if (url.indexOf('eos%3A%2F%2F') !== -1) {
      response.account = searchToAccount(url, "=eos%3A%2F%2F(.*?)\&")
      response.redirectUrl = response.account
        ? `http://${response.account}.eos`
        : 'https://eosdns.io'

    // For full domain
    } else if (url.indexOf('.eos/') !== -1) {
      response.account = searchToAccount(url, "//(.*?)\.eos/")
    }

    return response
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

function getDnsRecords (nodeUrl, contract, account, host, done) {
  const xhr = new XMLHttpRequest();
  const url = `${nodeUrl}/v1/chain/get_table_rows`;
  xhr.open("POST", url, true);
  xhr.setRequestHeader("Content-Type", "application/json");

  xhr.onreadystatechange = function () {
    if (xhr.readyState === 4 && xhr.status === 200) {
      const json = JSON.parse(xhr.responseText);

      if (json.rows && json.rows.length) {
        console.log('Blockchain ROWS', json.rows)
        // Redirect if found
        let HTTPREDRecord = json.rows.find(
          record => record.type.trim() === 'HTTPRED' && record.name.trim() === host + '.'
        )
        if (HTTPREDRecord) {
          return done({
            redirectUrl: HTTPREDRecord.value,
            error: false
          })
        }

        // Standard A record
        let ARecords = json.rows.filter(
          record => record.type.trim() === 'A' && record.name.trim() === host + '.'
        )
        if (ARecords.length) {
          return done({
            ip: ARecords[0].value,
            expiry: (new Date().getTime() / 1000) + ARecords[0].ttl,
            error: false
          });
        }

        // Error if nothing found yet
        return done({ error: true });
      }
    } else {
      return done({ error: true });
    }
  };

  xhr.onerror = function() {
    return done();
  };

  const data = JSON.stringify({
    "json": true,
    "code": contract,
    "scope": account,
    "table": "dns",
    "limit": 25
  });
  xhr.send(data);
}