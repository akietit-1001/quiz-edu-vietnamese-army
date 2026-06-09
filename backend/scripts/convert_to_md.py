import sys
import os

def main():
    if sys.platform == "win32":
        try:
            sys.stdout.reconfigure(encoding='utf-8')
            sys.stderr.reconfigure(encoding='utf-8')
        except AttributeError:
            pass

    if len(sys.argv) < 2:
        sys.stderr.write("Thiếu đường dẫn file tài liệu.\n")
        sys.exit(1)
        
    file_path = sys.argv[1]
    if not os.path.exists(file_path):
        sys.stderr.write(f"Không tìm thấy file: {file_path}\n")
        sys.exit(1)

    try:
        from markitdown import MarkItDown
        markitdown = MarkItDown()
        result = markitdown.convert(file_path)
        print(result.text_content)
    except ImportError:
        sys.stderr.write("Chưa cài đặt thư viện 'markitdown'. Vui lòng chạy 'pip install markitdown' trên hệ thống.\n")
        sys.exit(1)
    except Exception as e:
        sys.stderr.write(f"Lỗi chuyển đổi tài liệu: {str(e)}\n")
        sys.exit(1)

if __name__ == "__main__":
    main()
