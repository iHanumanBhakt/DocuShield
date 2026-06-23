import fs from "fs/promises";
import path from "path";
import readline from "readline";
import { auditContract } from "./src/auditor.js";

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const prompt = (q) => new Promise((resolve) => rl.question(q, resolve));

async function main() {
  console.log("\n🛡️  Welcome to DocuShield — Smart Compliance Auditor");
  console.log("===================================================\n");

  const contractsDir = "./data/contracts";
  try {
    // List contracts
    const files = await fs.readdir(contractsDir);
    const contracts = files.filter(f => f.endsWith(".txt") || f.endsWith(".md"));

    if (contracts.length === 0) {
      console.log(`⚠️ No contracts found in ${contractsDir}. Please place contracts to audit there.`);
      rl.close();
      return;
    }

    console.log("Available contracts to audit:");
    contracts.forEach((c, idx) => {
      console.log(`  [${idx + 1}] ${c}`);
    });
    console.log("");

    const choiceInput = await prompt("Select a contract number to audit: ");
    const choice = parseInt(choiceInput) - 1;

    if (isNaN(choice) || choice < 0 || choice >= contracts.length) {
      console.log("❌ Invalid choice. Exiting.");
      rl.close();
      return;
    }

    const selectedContract = contracts[choice];
    const contractPath = path.join(contractsDir, selectedContract);

    console.log(`⏳ Initializing compliance audit for ${selectedContract}...`);
    const startTime = Date.now();
    const reports = await auditContract(contractPath);
    const endTime = Date.now();

    console.log("\n===================================================");
    console.log(`📋 AUDIT COMPLETED IN ${((endTime - startTime) / 1000).toFixed(1)}s`);
    console.log("===================================================\n");

    let fullMarkdownReport = `# DocuShield Audit Report: ${selectedContract}\n\n`;
    fullMarkdownReport += `Generated on: ${new Date().toLocaleString()}\n`;
    fullMarkdownReport += `Source File: ${contractPath}\n\n`;

    for (const report of reports) {
      console.log(`---------------------------------------------------`);
      console.log(`📌 ${report.clauseTitle}`);
      console.log(`---------------------------------------------------`);

      if (report.error) {
        console.log(`❌ Audit Error: ${report.error}\n`);
        continue;
      }

      console.log(`Matched Regulations:`);
      report.retrievedContexts.forEach(ctx => {
        console.log(`  - ${ctx.header} (Similarity Score: ${ctx.score})`);
      });
      console.log(`\n${report.auditOutput}\n`);

      fullMarkdownReport += `## ${report.clauseTitle}\n\n`;
      fullMarkdownReport += `### Original Clause:\n> ${report.originalClause.split("\n").slice(1).join("\n")}\n\n`;
      fullMarkdownReport += `### Matching Regulations Used:\n`;
      report.retrievedContexts.forEach(ctx => {
        fullMarkdownReport += `* **${ctx.header}** (Similarity: ${ctx.score})\n`;
      });
      fullMarkdownReport += `\n${report.auditOutput}\n\n`;
      fullMarkdownReport += `----\n\n`;
    }

    // Save report to disk
    const reportOutPath = "./data/audit_report.md";
    await fs.writeFile(reportOutPath, fullMarkdownReport, "utf8");
    console.log(`💾 Full report saved to ${reportOutPath}\n`);

  } catch (err) {
    console.error(`❌ Audit failed to run: ${err.message}`);
  } finally {
    rl.close();
  }
}

main();
