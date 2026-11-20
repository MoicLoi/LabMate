# 本地假大模型服务（OpenAI 兼容），用于验证 LabMate 的识别/分支/公式链路
import json
import http.server
import socketserver

TABLE = {
    "template_id": "tpl-titration",
    "rows": [
        {"no": 1, "v0": 0.10, "v1": 25.62, "dv": 25.52, "remark": "第 1 次"},
        {"no": 2, "v0": 0.00, "v1": 25.48, "dv": 25.48, "remark": "第 2 次"},
        {"no": 3, "v0": 0.05, "v1": 25.56, "dv": 25.51, "remark": "第 3 次"},
    ],
    "warnings": ["第 2 行备注字迹较浅，按上下文补全"],
    "confidence": 0.93,
    "notes": "已按列名语义映射",
}

BRANCH = {
    "title": "滴定终点颜色异常",
    "subtitle": "AI 生成示例",
    "tag": "综合",
    "root": "n1",
    "nodes": [
        {"id": "n1", "type": "question", "title": "颜色异常的表现是？", "body": "先分类再处理。", "options": [
            {"id": "o1", "label": "加入指示剂后不变色", "kind": "possibility", "next": "n2", "prob": 0.6},
            {"id": "o2", "label": "终点颜色很快褪回", "kind": "qa", "next": "n3"},
        ]},
        {"id": "n2", "type": "action", "title": "检查指示剂", "body": "1. 确认指示剂未过期\n2. 重新配制 0.1% 酚酞", "options": []},
        {"id": "n3", "type": "result", "title": "半滴法确认终点", "body": "颜色保持 30 s 不褪即为终点。", "options": []},
    ],
}

FORMULA = r"c = \frac{n}{V} = \frac{m}{M V}"


class Handler(http.server.BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length).decode("utf-8")
        try:
            body = json.loads(raw)
        except Exception:
            body = {}
        blob = json.dumps(body.get("messages", []), ensure_ascii=False)
        model = body.get("model", "mock")

        if "image_url" in blob or "表格模板" in blob:
            text = json.dumps(TABLE, ensure_ascii=False)
        elif "分支决策树" in blob:
            text = json.dumps(BRANCH, ensure_ascii=False)
        elif "LaTeX" in blob and "只输出" in blob:
            text = FORMULA
        elif "实验流程步骤" in blob:
            text = json.dumps({"steps": [
                {"title": "预热仪器", "desc": "开机预热 15 分钟", "estMin": 15},
                {"title": "配制溶液", "desc": "按梯度配制标准系列", "estMin": 12},
            ]}, ensure_ascii=False)
        elif "学生的问题" in blob:
            text = "先确认终点是否稳定 30 s；若迅速褪回，多为指示剂过量，建议重做并减少用量。"
        else:
            text = "OK"

        resp = {
            "id": "chatcmpl-mock",
            "object": "chat.completion",
            "model": model,
            "choices": [{"index": 0, "message": {"role": "assistant", "content": text}, "finish_reason": "stop"}],
            "usage": {"prompt_tokens": 10, "completion_tokens": 10, "total_tokens": 20},
        }
        data = json.dumps(resp, ensure_ascii=False).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("0.0.0.0", 8765), Handler) as httpd:
        print("mock-llm listening on 8765", flush=True)
        httpd.serve_forever()
