import * as path from 'path';
import Mocha from 'mocha';
import { globSync } from 'glob';

// ---------------------- Config ----------------------
const testsRoot = path.resolve(__dirname, '../out/test'); // percorso cartella test compilata

// ---------------------- Setup Mocha ----------------------
const mocha = new Mocha({
    ui: 'bdd',
    color: true
});

// ---------------------- Trova tutti i test ----------------------
const testFiles = globSync('**/*.test.js', { cwd: testsRoot });

if (testFiles.length === 0) {
    console.warn('⚠️ Nessun test trovato in', testsRoot);
} else {
    console.log(`✅ Trovati ${testFiles.length} test`);
}

testFiles.forEach(file => {
    mocha.addFile(path.resolve(testsRoot, file));
});

// ---------------------- Esecuzione ----------------------
mocha.run(failures => {
    process.exitCode = failures ? 1 : 0;
});
