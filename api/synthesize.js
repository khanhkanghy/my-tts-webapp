/**
 * Vercel Serverless Function để chuyển đổi văn bản thành giọng nói bằng VoiceRSS API.
 * Chức năng này nhận văn bản, mã ngôn ngữ từ frontend,
 * sau đó gọi API VoiceRSS và trả về nội dung âm thanh dưới dạng base64.
 *
 * API Key của VoiceRSS được lấy từ biến môi trường của Vercel.
 */

// Import thư viện để xử lý tham số URL
const { URLSearchParams } = require('url');

// Hàm xử lý yêu cầu HTTP (đây là hàm chính của Serverless Function)
module.exports = async (req, res) => {
    // Thiết lập CORS để cho phép frontend truy cập từ các domain khác
    res.setHeader('Access-Control-Allow-Origin', '*'); // Cho phép tất cả các nguồn gốc
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS'); // Cho phép các phương thức
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type'); // Cho phép header Content-Type

    // Xử lý yêu cầu OPTIONS (preflight request) từ trình duyệt
    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
    }

    // Đảm bảo yêu cầu là POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Chỉ chấp nhận phương thức POST.' });
    }

    // Lấy dữ liệu từ body của yêu cầu
    const { text, languageCode } = req.body;

    // Kiểm tra dữ liệu đầu vào
    if (!text || typeof text !== 'string' || text.length === 0) {
        return res.status(400).json({ error: 'Vui lòng cung cấp văn bản hợp lệ.' });
    }
    if (!languageCode || typeof languageCode !== 'string' || languageCode.length === 0) {
        return res.status(400).json({ error: 'Vui lòng cung cấp mã ngôn ngữ hợp lệ.' });
    }

    // Lấy API Key từ biến môi trường của Vercel
    // Bạn sẽ cấu hình biến này trên bảng điều khiển Vercel
    const VOICERSS_API_KEY = process.env.VOICERSS_API_KEY;

    // Kiểm tra xem API Key đã được cấu hình chưa
    if (!VOICERSS_API_KEY) {
        console.error('VOICERSS_API_KEY chưa được cấu hình trong biến môi trường Vercel.');
        return res.status(500).json({ error: 'Lỗi cấu hình máy chủ: API Key chưa được thiết lập.' });
    }

    // Giới hạn độ dài văn bản để tránh chi phí cao và lỗi API
    const MAX_TEXT_LENGTH = 5000; // Giới hạn 5000 ký tự (hoặc theo giới hạn của VoiceRSS Free Tier)
    if (text.length > MAX_TEXT_LENGTH) {
        return res.status(400).json({ error: `Văn bản quá dài. Vui lòng nhập tối đa ${MAX_TEXT_LENGTH} ký tự.` });
    }

    try {
        // Tạo tham số URL cho yêu cầu VoiceRSS
        const params = new URLSearchParams({
            key: VOICERSS_API_KEY,
            hl: languageCode, // Ngôn ngữ
            src: text,       // Văn bản nguồn
            r: 0,            // Tốc độ (0 là bình thường)
            c: 'MP3',        // Định dạng đầu ra (MP3)
            f: '8khz_8bit_mono', // Định dạng file (có thể thay đổi nếu cần chất lượng cao hơn)
            ssml: false,     // Không sử dụng SSML
            b64: true        // Trả về dữ liệu base64 (quan trọng cho frontend)
        });

        // Gửi yêu cầu GET đến VoiceRSS API
        const voicerssResponse = await fetch(`http://api.voicerss.org/?${params.toString()}`);

        if (!voicerssResponse.ok) {
            const errorText = await voicerssResponse.text();
            console.error('Lỗi từ VoiceRSS API:', errorText);
            // VoiceRSS thường trả về lỗi dưới dạng văn bản.
            return res.status(voicerssResponse.status).json({ error: `Lỗi từ VoiceRSS: ${errorText}` });
        }

        // VoiceRSS trả về dữ liệu base64 trực tiếp nếu b64=true
        const audioContentBase64 = await voicerssResponse.text();

        // Kiểm tra xem dữ liệu trả về có phải là base64 hợp lệ không
        if (!audioContentBase64 || audioContentBase64.startsWith('ERROR')) {
            console.error('Dữ liệu âm thanh không hợp lệ từ VoiceRSS:', audioContentBase64);
            return res.status(500).json({ error: 'Không thể tạo âm thanh. Có thể đã hết hạn mức miễn phí hoặc API Key không hợp lệ.' });
        }

        // Gửi nội dung âm thanh base64 về cho frontend
        return res.status(200).json({ audioContent: audioContentBase64 });

    } catch (error) {
        console.error('Lỗi khi gọi VoiceRSS API:', error);
        return res.status(500).json({ error: 'Không thể chuyển đổi văn bản thành giọng nói. Vui lòng thử lại sau.', details: error.message });
    }
};
