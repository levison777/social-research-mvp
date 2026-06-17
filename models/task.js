const UNIFIED_BOARD_FIELDS = [
  "key_words",
  "platform",
  "content",
  "content_to_en",
  "sentiment_rating",
  "search_time",
  "comment_time",
  "topics",
  "language",
  "content_url",
  "engagement"
];

const COMMENT_BOARD_FIELDS = ["目标link", "评论者账号", "评论内容", "发布时间（UTC+8）", "sentiment rating", "链接"];

function bindTaskModel(runtime) {
  return runtime.models;
}

module.exports = {
  UNIFIED_BOARD_FIELDS,
  COMMENT_BOARD_FIELDS,
  bindTaskModel
};
