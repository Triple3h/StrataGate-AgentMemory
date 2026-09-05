#!/usr/bin/env node
/** Validate a frozen benchmark artifact and print the comparable scorecard. */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const args = process.argv.slice(2)
const inputIndex = args.indexOf('--input')
const input = resolve(inputIndex >= 0 ? args[inputIndex + 1] : 'benchmarks/locomo-conv26-r8-final.json')
const json = JSON.parse(readFileSync(input, 'utf8'))
const scope = json.scope
const result = json.final_round_eight
if (!scope || !result) throw new Error('Benchmark must contain scope and final_round_eight')
const required = ['completed_questions', 'judge_decisions', 'mean_accuracy_percent', 'majority_correct', 'retrieval', 'request_accounting']
for (const key of required) if (!(key in result)) throw new Error(`Benchmark is missing final_round_eight.${key}`)
if (!Number.isInteger(scope.questions) || scope.questions < 1) throw new Error('Benchmark scope.questions must be positive')
if (result.completed_questions !== scope.questions) throw new Error(`Incomplete benchmark: ${result.completed_questions}/${scope.questions} questions`)
if (result.judge_decisions !== scope.questions * 10) throw new Error(`Unexpected Judge count: ${result.judge_decisions}`)
if ((result.request_accounting.unrecovered_failed_calls ?? 0) !== 0) throw new Error('Benchmark contains unrecovered model failures')
if (result.majority_correct < 0 || result.majority_correct > scope.questions) throw new Error('Invalid majority_correct')
const categoryScores = result.by_category_mean_accuracy_percent ?? {}
for (const category of ['multi-hop', 'temporal', 'open-domain', 'single-hop']) {
  if (typeof categoryScores[category] !== 'number') throw new Error(`Benchmark is missing category score: ${category}`)
}
if (!Number.isFinite(result.retrieval?.rounds) || !Number.isFinite(result.retrieval?.assessment_calls)) {
  throw new Error('Benchmark is missing retrieval accounting')
}
const score = {
  benchmark: json.benchmark,
  conversation: scope.conversation,
  questions: scope.questions,
  categories: scope.categories,
  majority_correct: result.majority_correct,
  majority_accuracy_percent: result.majority_accuracy_percent,
  mean_accuracy_percent: result.mean_accuracy_percent,
  retrieval_p95_not_recorded: true,
  unrecovered_failed_calls: result.request_accounting.unrecovered_failed_calls,
}
const minIndex = args.indexOf('--min-majority')
if (minIndex >= 0) {
  const minimum = Number(args[minIndex + 1])
  if (!Number.isFinite(minimum) || result.majority_accuracy_percent < minimum) {
    throw new Error(`Benchmark majority accuracy ${result.majority_accuracy_percent}% is below ${args[minIndex + 1]}%`)
  }
}
process.stdout.write(`${JSON.stringify(score, null, 2)}\n`)
