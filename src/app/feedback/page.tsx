'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  getPublicFeedbackQuestions,
  submitPublicFeedback,
  FeedbackQuestion,
  PublicFeedbackInitialData,
  SubmitFeedbackResponse,
} from '@/services/feedback';

function FeedbackContent() {
  const searchParams = useSearchParams();
  const brandIdParam = searchParams.get('brandId');
  const storeIdParam = searchParams.get('storeId');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [initialData, setInitialData] = useState<PublicFeedbackInitialData | null>(null);

  // Form State
  const [ratingScore, setRatingScore] = useState<number>(5);
  const [answers, setAnswers] = useState<Record<number, any>>({});
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');

  // Result State
  const [resultData, setResultData] = useState<SubmitFeedbackResponse | null>(null);

  useEffect(() => {
    fetchQuestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandIdParam, storeIdParam]);

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const brandId = brandIdParam ? parseInt(brandIdParam, 10) : undefined;
      const storeId = storeIdParam ? parseInt(storeIdParam, 10) : undefined;

      const res = await getPublicFeedbackQuestions({ brandId, storeId });
      if (res?.data) {
        setInitialData(res.data);
      }
    } catch (err: any) {
      console.error('Failed to load feedback form:', err);
      toast.error(err.message || 'Không thể tải form đánh giá');
    } finally {
      setLoading(false);
    }
  };

  const handleOptionSelect = (questionId: number, option: string, isMulti: boolean) => {
    setAnswers((prev) => {
      if (isMulti) {
        const currentList: string[] = Array.isArray(prev[questionId]) ? prev[questionId] : [];
        const nextList = currentList.includes(option)
          ? currentList.filter((item) => item !== option)
          : [...currentList, option];
        return { ...prev, [questionId]: nextList };
      }
      return { ...prev, [questionId]: option };
    });
  };

  const handleTextAnswer = (questionId: number, text: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: text }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!initialData) return;

    const cleanPhone = customerPhone.replace(/\s+|-|\./g, '');
    if (!cleanPhone) {
      toast.error('Vui lòng nhập số điện thoại để tiếp tục');
      return;
    }

    if (!/^0(3|5|7|8|9)[0-9]{8}$/.test(cleanPhone)) {
      toast.error('Số điện thoại không đúng định dạng (phải gồm 10 chữ số)');
      return;
    }

    // Format answers array
    const formattedAnswers = (initialData.questions || []).map((q) => ({
      questionId: q.id,
      questionTitle: q.title,
      questionType: q.questionType,
      answer: answers[q.id] !== undefined ? answers[q.id] : '',
    }));

    setSubmitting(true);
    try {
      const payload = {
        brandId: initialData.brandId,
        storeId: initialData.storeId || (storeIdParam ? parseInt(storeIdParam, 10) : 0),
        customerPhone: cleanPhone,
        customerName: customerName.trim() || undefined,
        ratingScore: ratingScore,
        answersJson: JSON.stringify(formattedAnswers),
        deviceFingerprint: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
      };

      const res = await submitPublicFeedback(payload);
      if (res?.data) {
        setResultData(res.data);
        toast.success(res?.message || 'Gửi đánh giá thành công!');
      } else {
        toast.success(res?.message || 'Cảm ơn bạn đã gửi đánh giá!');
      }
    } catch (err: any) {
      console.error('Submit feedback failed:', err);
      toast.error(err.message || 'Gửi đánh giá thất bại, vui lòng thử lại');
    } finally {
      setSubmitting(false);
    }
  };

  const copyToClipboard = (text: string) => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(text);
      toast.success('Đã sao chép mã ưu đãi vào bộ nhớ tạm!');
    }
  };

  const getRatingLabel = (score: number) => {
    switch (score) {
      case 5:
        return { label: 'Tuyệt vời!', color: 'text-amber-500', emoji: '🌟' };
      case 4:
        return { label: 'Hài lòng', color: 'text-emerald-500', emoji: '😊' };
      case 3:
        return { label: 'Bình thường', color: 'text-blue-500', emoji: '😐' };
      case 2:
        return { label: 'Chưa hài lòng', color: 'text-orange-500', emoji: '🙁' };
      case 1:
        return { label: 'Rất thất vọng', color: 'text-red-500', emoji: '😡' };
      default:
        return { label: 'Đánh giá', color: 'text-gray-600', emoji: '⭐' };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center space-y-3">
          <div className="inline-block size-10 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
          <p className="text-sm font-medium text-gray-500">Đang tải form đánh giá...</p>
        </div>
      </div>
    );
  }

  // SUCCESS SCREEN
  if (resultData) {
    const isVoucher = resultData.isRewardGranted && (resultData.rewardType === 1 || resultData.rewardType === 2);
    const isPoints = resultData.isRewardGranted && resultData.rewardType === 3;
    const isCustomGift = resultData.isRewardGranted && resultData.rewardType === 4;

    return (
      <div className="min-h-screen bg-gradient-to-br from-brand-50 via-white to-amber-50/40 p-4 sm:p-6 flex items-center justify-center">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-gray-100 p-6 sm:p-8 text-center space-y-6 animate-fade-in">
          <div className="size-20 bg-gradient-to-tr from-emerald-400 to-teal-500 text-white rounded-full flex items-center justify-center mx-auto text-4xl shadow-lg shadow-emerald-200">
            🎉
          </div>

          <div>
            <h2 className="text-2xl font-bold text-gray-900">Cảm Ơn Bạn Đã Đánh Giá!</h2>
            <p className="text-sm text-gray-600 mt-2">
              Ý kiến của bạn là động lực to lớn giúp <span className="font-semibold text-brand-600">{resultData.storeName || 'chúng tôi'}</span> ngày càng hoàn thiện hơn.
            </p>
          </div>

          {/* REWARD CARD */}
          {isVoucher && (
            <div className="bg-gradient-to-r from-brand-600 via-indigo-600 to-purple-600 rounded-2xl p-5 text-white shadow-lg relative overflow-hidden text-left">
              <div className="absolute top-0 right-0 -mr-6 -mt-6 size-24 rounded-full bg-white/10 blur-xl" />
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider bg-white/20 px-2.5 py-1 rounded-full backdrop-blur-sm">
                  {resultData.rewardType === 1 ? '🎟️ Voucher Giảm Giá' : '💵 Voucher Tiền Mặt'}
                </span>
                <span className="text-xs text-white/80">HSD: {resultData.expiryDate}</span>
              </div>

              <div className="mt-3">
                <div className="text-3xl font-extrabold tracking-tight">
                  {resultData.rewardType === 1
                    ? `GIẢM ${resultData.discountRate}%`
                    : `GIẢM ${resultData.discountAmount.toLocaleString('vi-VN')} ₫`}
                </div>
                <div className="text-xs text-white/80 mt-0.5">
                  {resultData.rewardDescription || 'Áp dụng cho toàn bộ hóa đơn'}
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-white/20 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase text-white/70 block font-semibold">Mã ưu đãi của bạn</span>
                  <span className="text-xl font-mono font-bold tracking-widest">{resultData.voucherCode}</span>
                </div>
                <button
                  type="button"
                  onClick={() => copyToClipboard(resultData.voucherCode)}
                  className="rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-brand-600 shadow transition hover:bg-gray-100 active:scale-95"
                >
                  Sao chép
                </button>
              </div>
            </div>
          )}

          {isPoints && (
            <div className="bg-gradient-to-r from-amber-500 to-orange-600 rounded-2xl p-5 text-white shadow-lg text-left space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider bg-white/20 px-2.5 py-1 rounded-full inline-block">
                ⭐ Điểm Thành Viên
              </div>
              <div className="text-2xl font-black">+{resultData.pointsAwarded || 20} ĐIỂM TÍCH LŨY</div>
              <div className="text-xs text-white/90">
                {resultData.rewardDescription || 'Điểm đã được ghi nhận vào thẻ thành viên SĐT của bạn.'}
              </div>
            </div>
          )}

          {isCustomGift && (
            <div className="bg-gradient-to-r from-teal-600 to-emerald-600 rounded-2xl p-5 text-white shadow-lg text-left space-y-2">
              <div className="text-xs font-bold uppercase tracking-wider bg-white/20 px-2.5 py-1 rounded-full inline-block">
                🎁 Quà Tặng Tại Quầy
              </div>
              <div className="text-xl font-bold">{resultData.rewardTitle || 'Món Quà Tri Ân'}</div>
              <div className="text-xs text-white/90">
                {resultData.rewardDescription || 'Vui lòng đưa màn hình này cho nhân viên thu ngân tại quầy để nhận quà.'}
              </div>
            </div>
          )}

          {/* INSTRUCTIONS */}
          {isVoucher && (
            <div className="rounded-xl bg-gray-50 border border-gray-200/80 p-4 text-xs text-gray-600 text-left space-y-2">
              <div className="font-semibold text-gray-800 flex items-center gap-1.5">
                <span>📱</span> Cách thức sử dụng Voucher:
              </div>
              <p>• <span className="font-medium text-gray-800">Tại quầy thanh toán (POS):</span> Đọc Số điện thoại <span className="font-bold text-brand-600">{resultData.customerPhone}</span> hoặc đưa mã <span className="font-mono font-bold">{resultData.voucherCode}</span> cho thu ngân.</p>
              <p>• <span className="font-medium text-gray-800">Trên App Mobile:</span> Đăng nhập bằng SĐT này, mã ưu đãi đã tự động có sẵn trong <span className="font-semibold text-brand-600">Ví Voucher</span> để chọn khi đặt món.</p>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setResultData(null);
              setCustomerPhone('');
              setCustomerName('');
              setAnswers({});
            }}
            className="w-full rounded-xl bg-gray-100 hover:bg-gray-200 py-3 text-sm font-semibold text-gray-700 transition"
          >
            Đánh giá lần khác
          </button>
        </div>
      </div>
    );
  }

  const sentiment = getRatingLabel(ratingScore);

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50/50 via-gray-50 to-gray-100 py-6 px-4 sm:px-6 flex justify-center">
      <div className="w-full max-w-xl space-y-5">
        {/* STORE HEADER */}
        <div className="bg-white rounded-3xl shadow-sm border border-gray-200/80 p-6 text-center space-y-2">
          {initialData?.brandName && (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-600">
              ☕ {initialData.brandName}
            </div>
          )}
          <h1 className="text-2xl font-black tracking-tight text-gray-900">
            {initialData?.storeName || 'Đánh Giá Dịch Vụ'}
          </h1>
          {initialData?.storeAddress && (
            <p className="text-xs text-gray-500 flex items-center justify-center gap-1">
              📍 {initialData.storeAddress}
            </p>
          )}
        </div>

        {/* REWARD PROMO BANNER */}
        {initialData?.rewardInfo?.isRewardEnabled ? (
          <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 rounded-2xl p-4 text-white shadow-md flex items-center gap-3">
            <div className="size-12 rounded-xl bg-white/20 flex items-center justify-center text-2xl flex-shrink-0">
              🎁
            </div>
            <div>
              <div className="font-extrabold text-sm sm:text-base uppercase tracking-tight">
                {initialData.rewardInfo.title || 'Ưu Đãi Đánh Giá Dịch Vụ'}
              </div>
              <div className="text-xs text-white/90">
                {initialData.rewardInfo.description || 'Gửi đánh giá trải nghiệm để nhận ngay ưu đãi từ quán!'}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-gradient-to-r from-brand-600 to-indigo-600 rounded-2xl p-4 text-white shadow-md flex items-center gap-3">
            <div className="size-12 rounded-xl bg-white/20 flex items-center justify-center text-2xl flex-shrink-0">
              📝
            </div>
            <div>
              <div className="font-extrabold text-sm sm:text-base">KHẢO SÁT & ĐÓNG GÓP Ý KIẾN</div>
              <div className="text-xs text-white/90">Mọi phản hồi của bạn đều giúp chúng tôi nâng cao chất lượng phục vụ!</div>
            </div>
          </div>
        )}

        {/* FEEDBACK FORM */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* STAR RATING QUESTION */}
          <div className="bg-white rounded-3xl shadow-sm border border-gray-200/80 p-6 text-center space-y-4">
            <label className="block text-base font-bold text-gray-800">
              Bạn đánh giá thế nào về trải nghiệm hôm nay? <span className="text-red-500">*</span>
            </label>

            <div className="flex justify-center items-center gap-2 sm:gap-3 py-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRatingScore(star)}
                  className={`text-4xl sm:text-5xl transition-transform duration-200 active:scale-125 hover:scale-110 focus:outline-none ${
                    star <= ratingScore ? 'text-amber-400 drop-shadow' : 'text-gray-200'
                  }`}
                >
                  ★
                </button>
              ))}
            </div>

            <div className={`text-sm font-bold flex items-center justify-center gap-1.5 ${sentiment.color}`}>
              <span>{sentiment.emoji}</span>
              <span>{sentiment.label}</span>
            </div>
          </div>

          {/* DYNAMIC QUESTIONS */}
          {(initialData?.questions || [])
            .filter((q) => q.questionType !== 1) // Star rating handled above
            .map((q) => {
              let options: string[] = [];
              if (q.optionsJson) {
                try {
                  options = JSON.parse(q.optionsJson);
                } catch {
                  options = [];
                }
              }

              return (
                <div key={q.id} className="bg-white rounded-3xl shadow-sm border border-gray-200/80 p-5 space-y-3">
                  <label className="block text-sm font-bold text-gray-800">
                    {q.title} {q.isRequired && <span className="text-red-500">*</span>}
                  </label>

                  {/* SINGLE CHOICE OR MULTI CHOICE */}
                  {(q.questionType === 2 || q.questionType === 3) && options.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {options.map((opt, idx) => {
                        const isMulti = q.questionType === 3;
                        const currentVal = answers[q.id];
                        const isSelected = isMulti
                          ? Array.isArray(currentVal) && currentVal.includes(opt)
                          : currentVal === opt;

                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleOptionSelect(q.id, opt, isMulti)}
                            className={`rounded-xl px-3.5 py-2 text-xs font-semibold transition-all border ${
                              isSelected
                                ? 'bg-brand-50 border-brand-500 text-brand-700 shadow-sm'
                                : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                            }`}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {/* FREE TEXT */}
                  {q.questionType === 4 && (
                    <textarea
                      rows={3}
                      value={answers[q.id] || ''}
                      onChange={(e) => handleTextAnswer(q.id, e.target.value)}
                      placeholder="Nhập ý kiến góp ý của bạn để quán phục vụ tốt hơn..."
                      className="w-full rounded-2xl border border-gray-300 bg-gray-50/50 p-3 text-xs text-gray-800 placeholder-gray-400 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                    />
                  )}
                </div>
              );
            })}

          {/* CUSTOMER PHONE & NAME (FOR VOUCHER) */}
          <div className="bg-white rounded-3xl shadow-sm border border-gray-200/80 p-6 space-y-4">
            <div className="border-b border-gray-100 pb-3">
              <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                <span>📱</span> Thông tin người đánh giá
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {initialData?.rewardInfo?.isRewardEnabled
                  ? 'Phần quà ưu đãi sẽ được liên kết trực tiếp với Số điện thoại này.'
                  : 'Số điện thoại dùng để xác nhận lượt đánh giá của bạn.'}
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Số điện thoại của bạn <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Ví dụ: 0912345678"
                  className="w-full rounded-xl border border-gray-300 bg-gray-50/50 px-3.5 py-2.5 text-sm font-medium text-gray-800 placeholder-gray-400 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Họ và tên (không bắt buộc)
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Ví dụ: Nguyễn Văn A"
                  className="w-full rounded-xl border border-gray-300 bg-gray-50/50 px-3.5 py-2.5 text-sm font-medium text-gray-800 placeholder-gray-400 focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                />
              </div>
            </div>
          </div>

          {/* SUBMIT BUTTON */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-2xl bg-gradient-to-r from-brand-600 to-indigo-600 py-3.5 px-4 text-sm font-bold text-white shadow-lg shadow-brand-500/30 transition hover:from-brand-700 hover:to-indigo-700 active:scale-[0.98] disabled:opacity-50"
          >
            {submitting
              ? 'Đang gửi đánh giá...'
              : initialData?.rewardInfo?.isRewardEnabled
              ? 'Gửi Đánh Giá & Nhận Quà 🎉'
              : 'Gửi Đánh Giá Dịch Vụ'}
          </button>
        </form>

        <p className="text-[11px] text-gray-400 text-center">
          © {new Date().getFullYear()} RIBMS Platform
        </p>
      </div>
    </div>
  );
}

export default function FeedbackPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Đang tải...</div>}>
      <FeedbackContent />
    </Suspense>
  );
}
