/**
 * roots_dev (TaskTree) API連携ユーティリティ
 * 
 * roots_devのGraphQL APIと連携し、OKR/KPI/ToDoデータを取得・同期する
 */

// roots_dev API URL（環境変数で設定）
const ROOTS_API_URL = import.meta.env.VITE_ROOTS_API_URL || 'http://localhost:8080/graphql'

/**
 * GraphQLクエリを実行
 * @param {string} query - GraphQLクエリ
 * @param {object} variables - 変数
 * @param {string} accessToken - アクセストークン（Google OAuth）
 */
async function executeGraphQL(query, variables = {}, accessToken = null) {
  const headers = {
    'Content-Type': 'application/json',
  }

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`
  }

  const response = await fetch(ROOTS_API_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
  })

  if (!response.ok) {
    throw new Error(`GraphQL request failed: ${response.status}`)
  }

  const result = await response.json()

  if (result.errors) {
    console.error('GraphQL errors:', result.errors)
    throw new Error(result.errors[0]?.message || 'GraphQL error')
  }

  return result.data
}

/**
 * 現在のユーザーのToDoを取得
 * @param {string} accessToken - アクセストークン
 * @param {string} cycleId - サイクルID（オプション）
 */
export async function fetchRootsTodos(accessToken, cycleId = null) {
  const query = `
    query GetMyTodos($cycleId: String) {
      myTodos(cycleId: $cycleId) {
        id
        title
        note
        dueDate
        completedAt
        orderIndex
        objective {
          id
          title
          type
        }
        actionMap {
          id
          name
        }
        parent {
          id
          title
        }
        children {
          id
          title
          completedAt
        }
      }
    }
  `

  try {
    const data = await executeGraphQL(query, { cycleId }, accessToken)
    return data.myTodos || []
  } catch (error) {
    console.error('Failed to fetch roots todos:', error)
    throw error
  }
}

/**
 * 現在のユーザーのObjective（OKR）を取得
 * @param {string} accessToken - アクセストークン
 * @param {string} cycleId - サイクルID（オプション）
 */
export async function fetchRootsObjectives(accessToken, cycleId = null) {
  const query = `
    query GetMyObjectives($cycleId: String) {
      myObjectives(cycleId: $cycleId) {
        id
        title
        description
        type
        isKeyResult
        progress
        todos {
          id
          title
          completedAt
          dueDate
        }
        kpis {
          id
          name
          progress
        }
      }
    }
  `

  try {
    const data = await executeGraphQL(query, { cycleId }, accessToken)
    return data.myObjectives || []
  } catch (error) {
    console.error('Failed to fetch roots objectives:', error)
    throw error
  }
}

/**
 * roots_devでToDoを完了/未完了に更新
 * @param {string} accessToken - アクセストークン
 * @param {string} todoId - ToDoのID
 * @param {boolean} completed - 完了状態
 */
export async function updateRootsTodoCompletion(accessToken, todoId, completed) {
  const query = `
    mutation UpdateTodo($id: String!, $input: UpdateTodoInput!) {
      updateTodo(id: $id, input: $input) {
        id
        title
        completedAt
      }
    }
  `

  const variables = {
    id: todoId,
    input: {
      completedAt: completed ? new Date().toISOString() : null,
    },
  }

  try {
    const data = await executeGraphQL(query, variables, accessToken)
    return data.updateTodo
  } catch (error) {
    console.error('Failed to update roots todo:', error)
    throw error
  }
}

/**
 * アクティブなサイクルを取得
 * @param {string} accessToken - アクセストークン
 */
export async function fetchActiveCycle(accessToken) {
  const query = `
    query GetActiveCycle {
      activeCycle {
        id
        name
        startDate
        endDate
        status
      }
    }
  `

  try {
    const data = await executeGraphQL(query, {}, accessToken)
    return data.activeCycle
  } catch (error) {
    console.error('Failed to fetch active cycle:', error)
    throw error
  }
}

/**
 * roots_devのユーザー情報を取得
 * @param {string} accessToken - アクセストークン
 */
export async function fetchRootsUser(accessToken) {
  const query = `
    query GetMe {
      me {
        id
        email
        name
        role
        hierarchy
        image
      }
    }
  `

  try {
    const data = await executeGraphQL(query, {}, accessToken)
    return data.me
  } catch (error) {
    console.error('Failed to fetch roots user:', error)
    throw error
  }
}

/**
 * roots_devとの接続テスト
 * @param {string} accessToken - アクセストークン
 */
export async function testRootsConnection(accessToken) {
  try {
    const user = await fetchRootsUser(accessToken)
    return {
      connected: true,
      user,
    }
  } catch (error) {
    return {
      connected: false,
      error: error.message,
    }
  }
}

/**
 * roots_devのToDoをkintai-dev形式に変換
 * @param {object} rootsTodo - roots_devのToDoオブジェクト
 * @returns {object} - kintai-dev形式のToDo
 */
export function convertRootsTodoToKintai(rootsTodo) {
  return {
    content: rootsTodo.title,
    is_completed: !!rootsTodo.completedAt,
    roots_todo_id: rootsTodo.id,
    roots_objective_id: rootsTodo.objective?.id,
    roots_objective_title: rootsTodo.objective?.title,
    note: rootsTodo.note,
  }
}

