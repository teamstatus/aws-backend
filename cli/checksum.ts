import { checksum } from '../lambdas/checksum.js'
const input = process.argv[process.argv.length - 1]?.trim() ?? ''
console.log(`${input}\t${checksum(input)}`)
