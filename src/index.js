const http = require('http');
const fetch = require('node-fetch');
const uri = require('url');
const fileType = require('file-type');
const mime = require('mime');
const fs = require('fs');

http
  .createServer(function(req, res) {
    let url = req.url.substring(1);
    const userAgent = req.headers['user-agent'];
    const urlObj = uri.parse(url);
    const extRegx = /\.(\w+)$/.exec(urlObj.path || '');
    const ext = extRegx ? extRegx[1] : 'html';
    let domain = `${urlObj.protocol}//${urlObj.hostname}`;
    const referer = req.headers.referer;
    const refererObj = referer ? uri.parse(referer || '') : {};
    const refererUri = uri.parse(
      refererObj.path ? refererObj.path.substring(1) : ''
    );

    if (url === 'go') {
      res.writeHead(200, { 'Content-Type': 'text/html;charset=UTF-8' });
      res.write(fs.readFileSync(`./template/go.html`));
      res.end();
      return;
    }

    if (url.startsWith('http') === false && refererUri.hostname) {
      domain = `${refererUri.protocol}//${refererUri.hostname}`;
      url = `${domain}${url.startsWith('/') ? url : '/' + url}`;
    }

    if (typeof url === 'undefined' || url.startsWith('http') === false) {
      res.writeHead(200, { 'Content-Type': 'text/html;charset=UTF-8' });
      res.write(fs.readFileSync(`./template/index.html`));
      res.end();
      return;
    }

    console.log(`fetch url: ${url}`);

    fetch(url, {
      headers: {
        'user-agent': userAgent
      }
    })
      .then(r => {
        return r.buffer().then(buffer => {
          r.bufferData = buffer;
          return r;
        });
      })
      .then(r => {
        return fileType.fromBuffer(r.bufferData).then(info => {
          info = info || {};

          r.ext = info.ext || ext;
          r.isBinary = ['png', 'jpg', 'gif', 'bmp'].includes(r.ext);
          r.mime = info.mime || mime.getType(ext);
          console.log(`extension: ${r.ext}, mime type: ${r.mime}`);
          return r;
        });
      })
      .then(r => {
        if (!r.isBinary) {
          r.textData = r.bufferData
            .toString()
            .replace(/href="[/]/gi, `href="/${domain}/`)
            .replace(/src="[/]/gi, `src="/${domain}/`)
            .replace(/(['"])http:\/\//gi, '$1/http://')
            .replace(/(['"])https:\/\//gi, '$1/https://');
        }
        return r;
      })
      .then(r => {
        const headers = {};

        r.headers.forEach((value, key) => {
          if (
            [
              'content-type',
              'cache-control',
              'date',
              'expires',
              'access-control-allow-origin'
            ].indexOf(key.toLowerCase()) > -1
          ) {
            headers[key] = value;
          }
        });
        res.writeHead(200, headers);
        res.write(r.isBinary ? r.bufferData : r.textData);
        res.end();
      })
      .catch(r => {
        console.log('error', r);
        res.write(r);
        res.end();
      });
  })
  .listen(8080);
