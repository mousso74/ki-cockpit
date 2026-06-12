/* ======================================================================
 * attachments.js — Gemeinsamer Dateianhang-Manager für alle Templates
 *
 * Nutzung:
 *   attachments.init('container-id')   — UI in Container rendern
 *   attachments.getBlock()             — Prompt-Block als String
 *   attachments.hasFiles()             — true wenn mind. 1 Datei gewählt
 *   attachments.getNames()             — Array der Dateinamen
 *   attachments.reset()                — Auswahl leeren
 * ==================================================================== */

const attachments = (() => {
  let _files = [];       // Array von File-Objekten
  let _containerId = ''; // DOM-Container für die UI

  function _render() {
    const container = document.getElementById(_containerId);
    if (!container) return;

    container.innerHTML = '';

    // Button-Zeile
    const row = document.createElement('div');
    row.className = 'att-row';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-secondary att-btn';
    btn.innerHTML = '&#128206; Anhänge hinzufügen';
    btn.onclick = () => document.getElementById(_containerId + '-input').click();
    row.appendChild(btn);

    // Verstecktes file-input
    const input = document.createElement('input');
    input.type = 'file';
    input.id = _containerId + '-input';
    input.multiple = true;
    input.style.display = 'none';
    input.onchange = (e) => {
      const newFiles = Array.from(e.target.files || []);
      newFiles.forEach(f => {
        if (!_files.find(x => x.name === f.name && x.size === f.size)) {
          _files.push(f);
        }
      });
      e.target.value = ''; // Reset damit dieselbe Datei erneut gewählt werden kann
      _render();
    };
    row.appendChild(input);

    container.appendChild(row);

    // Dateiliste
    if (_files.length > 0) {
      const list = document.createElement('ul');
      list.className = 'att-list';
      _files.forEach((f, i) => {
        const li = document.createElement('li');
        li.className = 'att-item';

        const icon = _fileIcon(f.name);
        const size = _formatSize(f.size);

        li.innerHTML =
          '<span class="att-icon">' + icon + '</span>' +
          '<span class="att-name">' + _escHtml(f.name) + '</span>' +
          '<span class="att-size">(' + size + ')</span>' +
          '<button type="button" class="att-remove" title="Entfernen">&times;</button>';

        li.querySelector('.att-remove').onclick = () => {
          _files.splice(i, 1);
          _render();
        };
        list.appendChild(li);
      });
      container.appendChild(list);

      if (_files.length > 1) {
        const clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.className = 'att-clear';
        clearBtn.textContent = 'Alle entfernen';
        clearBtn.onclick = () => { _files = []; _render(); };
        container.appendChild(clearBtn);
      }
    }
  }

  function _fileIcon(name) {
    const ext = (name.split('.').pop() || '').toLowerCase();
    const map = {
      pdf: '📄', doc: '📝', docx: '📝', xls: '📊', xlsx: '📊',
      ppt: '📑', pptx: '📑', txt: '📃', md: '📃', csv: '📊',
      jpg: '🖼', jpeg: '🖼', png: '🖼', gif: '🖼', svg: '🖼',
      mp4: '🎬', mov: '🎬', mp3: '🎵', wav: '🎵',
      zip: '🗜', rar: '🗜', json: '💾', xml: '💾'
    };
    return map[ext] || '📎';
  }

  function _formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  function _escHtml(s) {
    return String(s).replace(/[&<>"]/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  // Öffentliche API
  return {
    init(containerId) {
      _containerId = containerId;
      _render();
    },

    reset() {
      _files = [];
      _render();
    },

    hasFiles() {
      return _files.length > 0;
    },

    getNames() {
      return _files.map(f => f.name);
    },

    /* Gibt den Anhang-Block zurück, der in jeden Prompt eingefügt wird. */
    getBlock() {
      if (_files.length === 0) return '';
      const list = _files.map(f => '- ' + f.name).join('\n');
      return [
        '',
        '[DATEIANHÄNGE]',
        'Ich habe dir folgende Datei' + (_files.length > 1 ? 'en' : '') + ' angehängt.',
        'Lies ' + (_files.length > 1 ? 'ihren Inhalt vollständig' : 'ihren Inhalt') +
          ' und berücksichtige ' + (_files.length > 1 ? 'ihn' : 'sie') + ' bei deiner Antwort:',
        list,
        '[/DATEIANHÄNGE]'
      ].join('\n');
    },

    /* Kurzer Erinnerungs-Hinweis für Folge-Prompts (Phase 2, Revision etc.) */
    getReminderBlock() {
      if (_files.length === 0) return '';
      const names = _files.map(f => f.name).join(', ');
      return '\n[HINWEIS DATEIANHÄNGE]\n' +
        'Du hast zu Beginn folgende Datei' + (_files.length > 1 ? 'en' : '') +
        ' erhalten: ' + names + '.\n' +
        'Berücksichtige deren Inhalt weiterhin in deiner Antwort.\n' +
        '[/HINWEIS DATEIANHÄNGE]';
    }
  };
})();
