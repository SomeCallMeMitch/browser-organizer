import {execFileSync} from 'node:child_process';
execFileSync(process.env.PYTHON || 'python3',['scripts/package.py'],{stdio:'inherit'});
