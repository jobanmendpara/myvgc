// Asks before logging out would lose changes kept on this device that the server doesn't have
// yet (ADR 17). Answered by UnsyncedChangesDialog, rendered once in app.vue.

interface Question {
  count: number
  answer: (lose: boolean) => void
}

const question = shallowRef<Question | null>(null)

/** Asks whether to log out and lose `count` unsynced changes. True if the User agrees. */
export function confirmLosingUnsynced(count: number): Promise<boolean> {
  question.value?.answer(false)
  return new Promise((resolve) => {
    question.value = {
      count,
      answer: (lose) => {
        question.value = null
        resolve(lose)
      },
    }
  })
}

/** Such as "3 changes on this phone haven't synced." */
export const unsyncedChangesText = (count: number) =>
  count === 1
    ? "1 change on this phone hasn't synced."
    : `${count} changes on this phone haven't synced.`

/** The question being asked, if any. */
export const useUnsyncedQuestion = () => readonly(question)
