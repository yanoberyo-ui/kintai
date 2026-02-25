/**
 * codex-dev (TaskTree) API連携ユーティリティ
 *
 * codex-devのGraphQL APIと連携し、DailyTodoデータを取得する
 */

// codex-dev API URL（環境変数で設定）
const ROOTS_API_URL = process.env.EXPO_PUBLIC_ROOTS_API_URL || 'http://localhost:8080/graphql';

/**
 * GraphQLクエリを実行
 */
async function executeGraphQL(query: string, variables: Record<string, any> = {}) {
  const response = await fetch(ROOTS_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`GraphQL request failed: ${response.status}`);
  }

  const result = await response.json();

  if (result.errors) {
    console.error('GraphQL errors:', result.errors);
    throw new Error(result.errors[0]?.message || 'GraphQL error');
  }

  return result.data;
}

// ======== DailyTodo API ========

const DAILY_TODO_FIELDS = `
  id
  title
  isCompleted
  completedAt
  orderIndex
  date
  userId
  parentId
  linkedTodoId
  createdAt
  updatedAt
  user {
    id
    name
    image
  }
`;

/**
 * 今日のToDoを取得（読み取り専用）
 */
export async function getDailyTodos(userId: string, date: Date = new Date()) {
  const query = `
    query GetDailyTodos($userId: ID!, $date: DateTime!) {
      dailyTodos(userId: $userId, date: $date) {
        ${DAILY_TODO_FIELDS}
        children {
          ${DAILY_TODO_FIELDS}
          children {
            ${DAILY_TODO_FIELDS}
          }
        }
      }
    }
  `;

  try {
    const data = await executeGraphQL(query, {
      userId,
      date: date.toISOString()
    });
    return data.dailyTodos || [];
  } catch (error) {
    console.error('Failed to fetch daily todos:', error);
    throw error;
  }
}

// ======== ユーザー API ========

/**
 * メールアドレスでcodex-devのユーザーを取得
 */
export async function getRootsUserByEmail(email: string) {
  const query = `
    query GetUserByEmail($email: String!) {
      getUserByEmail(email: $email) {
        id
        email
        name
        role
        hierarchy
        image
      }
    }
  `;

  try {
    const data = await executeGraphQL(query, { email });
    return data.getUserByEmail;
  } catch (error) {
    console.error('Failed to fetch codex-dev user by email:', error);
    throw error;
  }
}
