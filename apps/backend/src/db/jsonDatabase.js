import fs from 'fs';
import path from 'path';

const clone = (value) => JSON.parse(JSON.stringify(value));

export class JsonDatabase {
  constructor(file, initialData) {
    this.file = file;
    this.initialData = initialData;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    if (!fs.existsSync(file)) this.write(initialData);
  }

  read() {
    return JSON.parse(fs.readFileSync(this.file, 'utf8'));
  }

  write(data) {
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, this.file);
  }

  transact(mutator) {
    const data = this.read();
    const result = mutator(data);
    this.write(data);
    return clone(result ?? data);
  }

  nextId(data, collection) {
    const items = data[collection] || [];
    return items.length ? Math.max(...items.map((x) => Number(x.id) || 0)) + 1 : 1;
  }
}
