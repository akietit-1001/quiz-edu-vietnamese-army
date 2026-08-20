import AiUsageLog from '../models/AiUsageLog.js';

// GET AI USAGE SUMMARY (master-admin only) — tổng quan chi phí AI để kiểm
// soát chi phí ở quy mô lớn: tổng lượt gọi/token/chi phí ước tính, xu hướng
// theo ngày, và top người dùng theo chi phí trong khoảng thời gian truy vấn.
export const getAiUsageSummary = async (req, res) => {
  try {
    const days = Math.min(Math.max(parseInt(req.query.days) || 30, 1), 365);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const match = { createdAt: { $gte: since } };

    const [totalsAgg, byDay, byUser] = await Promise.all([
      AiUsageLog.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            totalCalls: { $sum: 1 },
            totalAttempts: { $sum: '$attemptCount' },
            totalTokens: { $sum: '$totalTokens' },
            totalCost: { $sum: '$estimatedCostUsd' },
            failedCalls: { $sum: { $cond: ['$succeeded', 0, 1] } }
          }
        }
      ]),
      AiUsageLog.aggregate([
        { $match: match },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            calls: { $sum: 1 },
            tokens: { $sum: '$totalTokens' },
            cost: { $sum: '$estimatedCostUsd' }
          }
        },
        { $sort: { _id: 1 } }
      ]),
      AiUsageLog.aggregate([
        { $match: match },
        {
          $group: {
            _id: '$userId',
            calls: { $sum: 1 },
            tokens: { $sum: '$totalTokens' },
            cost: { $sum: '$estimatedCostUsd' }
          }
        },
        { $sort: { cost: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'user'
          }
        },
        { $unwind: '$user' },
        {
          $project: {
            _id: 0,
            userId: '$_id',
            fullName: '$user.fullName',
            rank: '$user.rank',
            calls: 1,
            tokens: 1,
            cost: 1
          }
        }
      ])
    ]);

    const totals = totalsAgg[0] || { totalCalls: 0, totalAttempts: 0, totalTokens: 0, totalCost: 0, failedCalls: 0 };

    res.status(200).json({
      rangeDays: days,
      totalCalls: totals.totalCalls,
      totalAttempts: totals.totalAttempts,
      totalTokens: totals.totalTokens,
      totalCost: totals.totalCost,
      failedCalls: totals.failedCalls,
      byDay: byDay.map(d => ({ date: d._id, calls: d.calls, tokens: d.tokens, cost: d.cost })),
      byUser,
      pricingNote: 'Chi phí là ƯỚC TÍNH dựa trên đơn giá cấu hình trong hệ thống (GEMINI_INPUT_PRICE_PER_1M_USD / GEMINI_OUTPUT_PRICE_PER_1M_USD), không phải hóa đơn chính thức từ Google Cloud — vui lòng đối chiếu định kỳ.'
    });
  } catch (error) {
    console.error('Lỗi lấy thống kê chi phí AI:', error.message);
    res.status(500).json({ message: 'Lỗi máy chủ khi lấy thống kê chi phí AI' });
  }
};
