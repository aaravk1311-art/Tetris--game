from flask import Flask,render_template
app = Flask(__name__, static_folder="static", template_folder="templates")

@app.route("/")
def index():
    return render_template("tetris.html")
if __name__ == "__main__":
    #debug=True for development
    app.run(debug=True, host = "127.0.0.1", port=5000)
    
