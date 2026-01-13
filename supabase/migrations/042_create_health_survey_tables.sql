-- =====================================================
-- Health Survey System Tables
-- 完全匿名のエンゲージメントサーベイシステム
-- =====================================================

-- 1. health_surveys（サーベイマスター）
CREATE TABLE IF NOT EXISTS health_surveys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT,
    frequency TEXT NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('weekly', 'biweekly', 'monthly')),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. health_survey_questions（質問マスター）
CREATE TABLE IF NOT EXISTS health_survey_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_id UUID NOT NULL REFERENCES health_surveys(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    question_text TEXT NOT NULL,
    question_type TEXT NOT NULL DEFAULT 'scale' CHECK (question_type IN ('scale', 'text')),
    order_index INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. health_survey_responses（匿名回答）
-- 注意: user_idは保存しない（完全匿名）
CREATE TABLE IF NOT EXISTS health_survey_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_id UUID NOT NULL REFERENCES health_surveys(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES health_survey_questions(id) ON DELETE CASCADE,
    department TEXT,
    score INT CHECK (score >= 1 AND score <= 5),
    free_text TEXT,
    response_period TEXT NOT NULL, -- '2026-01' 等
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. health_survey_completions（回答済みチェック用）
-- 回答内容とは紐付けない（完全匿名を担保）
CREATE TABLE IF NOT EXISTS health_survey_completions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    survey_id UUID NOT NULL REFERENCES health_surveys(id) ON DELETE CASCADE,
    response_period TEXT NOT NULL, -- '2026-01' 等
    completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, survey_id, response_period)
);

-- インデックス作成
CREATE INDEX IF NOT EXISTS idx_health_survey_questions_survey_id ON health_survey_questions(survey_id);
CREATE INDEX IF NOT EXISTS idx_health_survey_responses_survey_id ON health_survey_responses(survey_id);
CREATE INDEX IF NOT EXISTS idx_health_survey_responses_period ON health_survey_responses(response_period);
CREATE INDEX IF NOT EXISTS idx_health_survey_responses_department ON health_survey_responses(department);
CREATE INDEX IF NOT EXISTS idx_health_survey_completions_user_period ON health_survey_completions(user_id, response_period);

-- RLSポリシー設定
ALTER TABLE health_surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_survey_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_survey_completions ENABLE ROW LEVEL SECURITY;

-- health_surveys: 全員が読み取り可能、管理者のみ編集可能
CREATE POLICY "health_surveys_select_policy" ON health_surveys
    FOR SELECT USING (true);

CREATE POLICY "health_surveys_insert_policy" ON health_surveys
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "health_surveys_update_policy" ON health_surveys
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

-- health_survey_questions: 全員が読み取り可能、管理者のみ編集可能
CREATE POLICY "health_survey_questions_select_policy" ON health_survey_questions
    FOR SELECT USING (true);

CREATE POLICY "health_survey_questions_insert_policy" ON health_survey_questions
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

-- health_survey_responses: 全員が挿入可能、管理者のみ読み取り可能
CREATE POLICY "health_survey_responses_insert_policy" ON health_survey_responses
    FOR INSERT WITH CHECK (true);

CREATE POLICY "health_survey_responses_select_policy" ON health_survey_responses
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

-- health_survey_completions: 自分の回答済み状態のみ確認・登録可能
CREATE POLICY "health_survey_completions_select_policy" ON health_survey_completions
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "health_survey_completions_insert_policy" ON health_survey_completions
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- =====================================================
-- 初期データ投入: デフォルトサーベイと質問
-- =====================================================

-- デフォルトサーベイ作成
INSERT INTO health_surveys (id, title, description, frequency, is_active)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'エンゲージメントサーベイ',
    '社員の心理状態や働きがいを把握するためのアンケートです。回答は完全匿名で、個人が特定されることはありません。',
    'monthly',
    true
) ON CONFLICT DO NOTHING;

-- デフォルト質問セット（Wevox参考）
INSERT INTO health_survey_questions (survey_id, category, question_text, question_type, order_index)
VALUES
    -- 仕事のやりがい
    ('a0000000-0000-0000-0000-000000000001', '仕事', '今の仕事にやりがいを感じていますか？', 'scale', 1),
    ('a0000000-0000-0000-0000-000000000001', '仕事', '自分の仕事が会社に貢献していると感じますか？', 'scale', 2),
    
    -- 人間関係
    ('a0000000-0000-0000-0000-000000000001', '人間関係', 'チームのメンバーとの関係は良好ですか？', 'scale', 3),
    ('a0000000-0000-0000-0000-000000000001', '人間関係', '上司や同僚とコミュニケーションが取れていますか？', 'scale', 4),
    
    -- 健康状態
    ('a0000000-0000-0000-0000-000000000001', '健康', '心身の健康状態は良好ですか？', 'scale', 5),
    ('a0000000-0000-0000-0000-000000000001', '健康', '十分な休息が取れていますか？', 'scale', 6),
    
    -- 成長
    ('a0000000-0000-0000-0000-000000000001', '成長', '仕事を通じて成長できていると感じますか？', 'scale', 7),
    ('a0000000-0000-0000-0000-000000000001', '成長', 'スキルアップの機会がありますか？', 'scale', 8),
    
    -- 承認
    ('a0000000-0000-0000-0000-000000000001', '承認', '自分の仕事が認められていると感じますか？', 'scale', 9),
    ('a0000000-0000-0000-0000-000000000001', '承認', '適切なフィードバックを受けていますか？', 'scale', 10),
    
    -- 支援
    ('a0000000-0000-0000-0000-000000000001', '支援', '困ったときに助けを求められる環境ですか？', 'scale', 11),
    ('a0000000-0000-0000-0000-000000000001', '支援', '必要なリソースやツールは揃っていますか？', 'scale', 12),
    
    -- 自由記述
    ('a0000000-0000-0000-0000-000000000001', 'フリー', '会社や職場環境について、何かあればお聞かせください（任意）', 'text', 13)
ON CONFLICT DO NOTHING;
